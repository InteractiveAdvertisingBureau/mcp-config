import { Router } from 'express';
const router = Router();
import * as apiService from '../database/apiService.js';
import * as apiTester from '../services/apiTester.js';
import { validateDomain, rateLimit } from '../middleware/validationMiddleware.js';
import { multiModelService } from '../services/multiModelService.js';

// Apply rate limiting
router.use(rateLimit(100, 60000)); // 100 requests per minute

// Health check
router.get("/health", function (req, res) {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ============================================
// API Registration & Management Routes
// ============================================

/**
 * POST /api/register
 * Register a new API endpoint for testing
 * Automatically tests the API and stores metadata after registration
 */
router.post("/register", async (req, res) => {
  try {
    const { name, endpoint, method, request_type, request_params, description } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        error: "Bad Request",
        message: "endpoint is required"
      });
    }

    console.log(`📝 Registering API: ${name || endpoint}`);

    // Step 1: Enhance description with AI if provided or generate one
    let enhancedDescription = description;
    try {
      const descriptionPrompt = description
        ? `Refactor and extend this API description to be more comprehensive and professional:\n\nOriginal: "${description}"\n\nAPI: ${method} ${endpoint}\n\nProvide an enhanced description (max 200 chars):`
        : `Generate a brief, professional description for this API:\n\nAPI: ${method} ${endpoint}\nName: ${name || 'Unknown'}\n\nProvide a description (max 200 chars):`;

      const aiResponse = await multiModelService.generateCompletion('default', descriptionPrompt, {
        temperature: 0.5,
        maxTokens: 100
      });

      enhancedDescription = aiResponse.content.trim().replace(/^["']|["']$/g, '').substring(0, 200);
      console.log(`✨ AI-enhanced description: ${enhancedDescription}`);
    } catch (aiError) {
      console.warn('⚠️ AI description enhancement failed, using original:', aiError.message);
      enhancedDescription = description || `${method} endpoint for ${endpoint}`;
    }

    // Step 2: Register the API with enhanced description
    const api = await apiService.registerAPI({
      name,
      endpoint,
      method,
      request_type,
      request_params,
      description: enhancedDescription
    });

    console.log(`✅ API registered with ID: ${api.id}`);

    // Step 3: Auto-generate test scenarios
    console.log(`🔧 Auto-generating test scenarios...`);
    const scenarios = apiTester.generateTestScenarios(api);
    console.log(`✅ Generated ${scenarios.length} test scenarios`);

    // Step 4: Automatically run tests (async, don't wait)
    setImmediate(async () => {
      try {
        console.log(`🧪 Starting automatic test for API ${api.id}...`);
        const testResults = await apiTester.testAPIWithScenarios(api.id, scenarios);
        console.log(`✅ Automatic test completed for API ${api.id}:`);
        console.log(`   - Successful: ${testResults.successful_tests}/${testResults.total_scenarios}`);
        console.log(`   - Failed: ${testResults.failed_tests}/${testResults.total_scenarios}`);
      } catch (testError) {
        console.error(`❌ Automatic test failed for API ${api.id}:`, testError.message);
      }
    });

    // Step 5: Return response immediately (tests run in background)
    res.status(201).json({
      success: true,
      message: "API registered successfully. Automatic testing initiated in background.",
      api: {
        ...api,
        auto_test_status: "running",
        scenarios_generated: scenarios.length
      },
      auto_testing: {
        enabled: true,
        scenarios_count: scenarios.length,
        status: "initiated"
      }
    });
  } catch (error) {
    console.error('Error registering API:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/apis
 * List all registered APIs
 */
router.get("/apis", async (req, res) => {
  try {
    const { status, method, limit } = req.query;

    const apis = await apiService.getAllAPIs({
      status,
      method,
      limit: limit ? parseInt(limit) : 50
    });

    res.json({
      success: true,
      total: apis.length,
      apis
    });
  } catch (error) {
    console.error('Error fetching APIs:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/apis/:id
 * Get specific API by ID
 */
router.get("/apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const api = await apiService.getAPIById(apiId);

    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    res.json({
      success: true,
      api
    });
  } catch (error) {
    console.error('Error fetching API:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * PUT /api/apis/:id
 * Update an API
 */
router.put("/apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const updates = req.body;

    const updatedAPI = await apiService.updateAPI(apiId, updates);

    res.json({
      success: true,
      message: "API updated successfully",
      api: updatedAPI
    });
  } catch (error) {
    console.error('Error updating API:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * DELETE /api/apis/:id
 * Delete an API
 */
router.delete("/apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const deleted = await apiService.deleteAPI(apiId);

    if (!deleted) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    res.json({
      success: true,
      message: "API deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting API:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// ============================================
// API Testing Routes
// ============================================

/**
 * POST /api/test/:id
 * Test an API with scenarios
 */
router.post("/test/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const { scenarios } = req.body;

    const results = await apiTester.testAPIWithScenarios(apiId, scenarios || []);

    res.json({
      success: true,
      message: "API testing completed",
      ...results
    });
  } catch (error) {
    console.error('Error testing API:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/test/:id/results
 * Get test results for an API
 */
router.get("/test/:id/results", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;

    const results = await apiService.getTestResults(apiId, limit);

    res.json({
      success: true,
      api_id: apiId,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching test results:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/test/:id/scenarios
 * Generate test scenarios for an API (uses learned metadata patterns)
 */
router.get("/test/:id/scenarios", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const api = await apiService.getAPIById(apiId);

    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    // Fetch latest AI metadata to get auth requirements
    let metadata = null;
    try {
      const aiMetadata = await apiService.getAIMetadata(apiId, 1);
      if (aiMetadata && aiMetadata.length > 0) {
        const latestMetadata = aiMetadata[0];
        // Extract auth requirements from recommendations JSON
        if (latestMetadata.ai_recommendations) {
          metadata = {
            authorization_required: latestMetadata.ai_recommendations.authorization_required || false,
            auth_type: latestMetadata.ai_recommendations.auth_type || 'Bearer Token',
            required_headers: latestMetadata.ai_recommendations.required_headers || [],
            required_params: latestMetadata.ai_recommendations.required_params || []
          };
          console.log(`📊 Using learned metadata - Auth Required: ${metadata.authorization_required}`);
        }
      }
    } catch (metadataError) {
      console.warn('⚠️ Could not fetch metadata, using default scenarios:', metadataError.message);
    }

    // Generate scenarios with metadata
    const scenarios = apiTester.generateTestScenarios(api, metadata);

    res.json({
      success: true,
      api_id: apiId,
      metadata_used: metadata !== null,
      learned_patterns: metadata,
      scenarios
    });
  } catch (error) {
    console.error('Error generating scenarios:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/test/:id/sample-data
 * Generate realistic sample data for testing an API using AI
 */
router.get("/test/:id/sample-data", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const api = await apiService.getAPIById(apiId);

    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    // Fetch metadata to understand auth requirements
    let metadata = null;
    try {
      const aiMetadata = await apiService.getAIMetadata(apiId, 1);
      if (aiMetadata && aiMetadata.length > 0) {
        metadata = aiMetadata[0];
      }
    } catch (metadataError) {
      console.warn('⚠️ Could not fetch metadata:', metadataError.message);
    }

    // Generate sample data using AI
    console.log(`🎨 Generating sample data for API: ${api.name}`);

    const prompt = `Generate realistic sample data for testing this API:

API Details:
- Name: ${api.name}
- Endpoint: ${api.endpoint}
- Method: ${api.method}
- Description: ${api.description}
${metadata ? `
Learned Patterns:
- Authorization Required: ${metadata.ai_recommendations?.authorization_required || false}
- Auth Type: ${metadata.ai_recommendations?.auth_type || 'None'}
- Required Headers: ${JSON.stringify(metadata.ai_recommendations?.required_headers || [])}
` : ''}

Please generate realistic sample values for:
1. Authorization token (if required) - make it look realistic but clearly marked as placeholder
2. Request parameters/body (if this API needs them)
3. Any additional headers that might be useful

Respond in JSON format:
{
  "authorization": "Bearer ghp_1234567890abcdef..." or null,
  "headers": {
    "Content-Type": "application/json",
    "X-Custom-Header": "value"
  },
  "params": {
    "param1": "sample_value",
    "param2": 123
  },
  "notes": "Brief explanation of sample data"
}`;

    try {
      const aiResponse = await multiModelService.generateCompletion('default', prompt, {
        temperature: 0.7,
        maxTokens: 500
      });

      // Parse AI response
      let sampleData;
      try {
        const content = aiResponse.content || aiResponse;
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
        sampleData = JSON.parse(jsonMatch[1] || content);
      } catch (parseError) {
        console.warn('⚠️ Failed to parse AI response, using defaults');
        sampleData = {
          authorization: metadata?.ai_recommendations?.authorization_required
            ? `Bearer ${metadata.ai_recommendations.auth_type === 'API Key' ? 'YOUR_API_KEY_HERE' : 'YOUR_TOKEN_HERE'}`
            : null,
          headers: { 'Content-Type': api.request_type },
          params: api.request_params || {},
          notes: 'Using default sample data'
        };
      }

      console.log(`✅ Sample data generated successfully`);

      res.json({
        success: true,
        api_id: apiId,
        sample_data: sampleData,
        metadata_used: metadata !== null
      });
    } catch (aiError) {
      console.error('❌ AI generation failed:', aiError.message);
      // Return basic sample data as fallback
      res.json({
        success: true,
        api_id: apiId,
        sample_data: {
          authorization: metadata?.ai_recommendations?.authorization_required
            ? `Bearer YOUR_TOKEN_HERE`
            : null,
          headers: { 'Content-Type': api.request_type },
          params: api.request_params || {},
          notes: 'Using fallback sample data (AI unavailable)'
        },
        metadata_used: metadata !== null
      });
    }
  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// ============================================
// Statistics & Metadata Routes
// ============================================

/**
 * GET /api/stats/:id
 * Get API statistics
 */
router.get("/stats/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const stats = await apiService.getAPIStatistics(apiId);

    if (!stats) {
      return res.status(404).json({
        error: "Not Found",
        message: `No statistics found for API ID ${apiId}`
      });
    }

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/stats
 * Get all API statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await apiService.getAllAPIStatistics();

    res.json({
      success: true,
      total: stats.length,
      statistics: stats
    });
  } catch (error) {
    console.error('Error fetching all statistics:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * GET /api/metadata/:id
 * Get AI metadata for an API
 */
router.get("/metadata/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;

    const metadata = await apiService.getAIMetadata(apiId, limit);

    res.json({
      success: true,
      api_id: apiId,
      total: metadata.length,
      metadata
    });
  } catch (error) {
    console.error('Error fetching AI metadata:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

export default router;
