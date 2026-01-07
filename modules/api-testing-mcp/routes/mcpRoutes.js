import { Router } from 'express';
const router = Router();
import * as apiService from '../services/apiService.js';
import * as apiTester from '../services/apiTester.js';
import { validateDomain, rateLimit } from '../middleware/validationMiddleware.js';
import { multiModelService } from '../services/multiModelService.js';

/**
 * Helper function to handle errors and return appropriate HTTP status codes
 */
function handleError(res, error, defaultMessage = 'Internal Server Error') {
  console.error('Error:', error);

  // Determine appropriate status code and user-friendly message
  let statusCode = 500;
  let errorType = defaultMessage;
  let userMessage = error.message || defaultMessage;

  // Context length / token limit errors
  if (error.message && (error.message.includes('Context limit exceeded') || error.message.includes('maximum context length'))) {
    statusCode = 413; // Payload Too Large
    errorType = 'Context Limit Exceeded';
  }
  // Rate limit errors
  else if (error.message && error.message.includes('Rate limit exceeded')) {
    statusCode = 429; // Too Many Requests
    errorType = 'Rate Limit Exceeded';
  }
  // Authentication errors
  else if (error.message && (error.message.includes('Authentication failed') || error.message.includes('Invalid API key'))) {
    statusCode = 401; // Unauthorized
    errorType = 'Authentication Error';
  }
  // Validation errors
  else if (error.message && (error.message.includes('Bad Request') || error.message.includes('Invalid'))) {
    statusCode = 400; // Bad Request
    errorType = 'Validation Error';
  }
  // Not found errors
  else if (error.message && error.message.includes('not found')) {
    statusCode = 404; // Not Found
    errorType = 'Not Found';
  }

  return res.status(statusCode).json({
    error: errorType,
    message: userMessage,
    success: false
  });
}

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
    const { name, endpoint, method, request_type, request_params, description, auth_required, auth_type, auth_token } = req.body;

    // Validation
    if (!endpoint) {
      return res.status(400).json({
        error: "Bad Request",
        message: "endpoint is required"
      });
    }

    // Validate endpoint URL format
    try {
      new URL(endpoint);
    } catch (urlError) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid endpoint URL format"
      });
    }

    // Validate auth fields if auth is required
    if (auth_required) {
      if (!auth_type) {
        return res.status(400).json({
          error: "Bad Request",
          message: "auth_type is required when auth_required is true"
        });
      }

      const validAuthTypes = ['Bearer Token', 'API Key', 'Basic Auth', 'OAuth'];
      if (!validAuthTypes.includes(auth_type)) {
        return res.status(400).json({
          error: "Bad Request",
          message: `Invalid auth_type. Must be one of: ${validAuthTypes.join(', ')}`
        });
      }

      if (!auth_token) {
        console.warn(`⚠️  Warning: auth_required is true but no auth_token provided`);
      }
    }

    console.log(`📝 Registering API: ${name || endpoint}`);
    console.log(`🔐 Auth settings - Required: ${auth_required}, Type: ${auth_type}, Token: ${auth_token ? '✓ Provided' : '✗ Missing'}`);
    console.log(`📋 Request params structure:`, JSON.stringify(request_params, null, 2));

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
      description: enhancedDescription,
      auth_required,
      auth_type,
      auth_token
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
    return handleError(res, error, 'Registration Error');
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
 * Query param: includeToken=true for internal edit operations (includes masked token indicator)
 */
router.get("/apis/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const includeTokenForEdit = req.query.includeToken === 'true';

    // Get API - if includeToken=true, we return with token (for edit form)
    const api = await apiService.getAPIById(apiId, includeTokenForEdit);

    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    // If including token for edit, indicate token exists without exposing it
    if (includeTokenForEdit && api.auth_token) {
      api.auth_token_exists = true;
      api.auth_token = ''; // Don't send actual token to frontend
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

    console.log(`🔍 Fetching scenarios for API ${apiId}`);
    console.log(`📋 API auth_required: ${api?.auth_required}, auth_type: ${api?.auth_type}, auth_token: ${api?.auth_token ? '✓ Present' : '✗ Missing'}`);

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
    return handleError(res, error, 'Sample Data Generation Error');
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

/**
 * GET /api/metadata
 * Get all API metadata
 */
router.get("/metadata", async (req, res) => {
  try {
    const allApis = await apiService.getAllAPIs({});
    const allMetadata = await Promise.all(
      allApis.map(async (api) => {
        const metadata = await apiService.getAIMetadata(api.id, 1);
        return {
          api_id: api.id,
          api_name: api.name,
          endpoint: api.endpoint,
          metadata: metadata[0] || null
        };
      })
    );

    res.json({
      success: true,
      total: allMetadata.length,
      metadata: allMetadata
    });
  } catch (error) {
    console.error('Error fetching all metadata:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// ============================================
// Chat/Query Interface Routes
// ============================================

/**
 * POST /api/query/:id/with-summary
 * Execute API call and return response with AI summary
 */
router.post("/query/:id/with-summary", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const { params = {}, headers = {} } = req.body;

    console.log(`🔍 Querying API ${apiId} with summary`);

    const api = await apiService.getAPIById(apiId);
    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    // Execute API call
    const testResult = await apiTester.executeAPICall(api, {
      params: params || api.request_params || {},
      headers: headers || {}
    });

    // Generate AI summary
    const summaryPrompt = `Analyze this API response and provide a concise summary:

API: ${api.name} (${api.method} ${api.endpoint})
Status: ${testResult.status}
Response Time: ${testResult.response_time}ms

Response Data:
${JSON.stringify(testResult.body, null, 2)}

Provide:
1. Brief summary of what the API returned
2. Key data points
3. Any notable patterns or insights
4. Potential issues or recommendations`;

    const aiResponse = await multiModelService.generateCompletion('default', summaryPrompt, {
      temperature: 0.3,
      maxTokens: 500
    });

    res.json({
      success: true,
      api_id: apiId,
      api_name: api.name,
      endpoint: api.endpoint,
      method: api.method,
      response: {
        status: testResult.status,
        response_time: testResult.response_time,
        body: testResult.body
      },
      ai_summary: aiResponse.content || aiResponse,
      model_used: aiResponse.provider || 'default'
    });
  } catch (error) {
    return handleError(res, error, 'Query Error');
  }
});

/**
 * POST /api/validate/:id
 * Validate request parameters and execute API call
 */
router.post("/validate/:id", async (req, res) => {
  try {
    const apiId = parseInt(req.params.id);
    const { params = {}, headers = {}, method } = req.body;

    console.log(`✅ Validating and executing API ${apiId}`);

    const api = await apiService.getAPIById(apiId);
    if (!api) {
      return res.status(404).json({
        error: "Not Found",
        message: `API with ID ${apiId} not found`
      });
    }

    // Validate HTTP method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const requestMethod = method || api.method;
    if (!validMethods.includes(requestMethod)) {
      return res.status(400).json({
        error: "Invalid HTTP method",
        provided: requestMethod,
        allowed: validMethods
      });
    }

    // Validate method matches registered API
    if (method && method !== api.method) {
      return res.status(400).json({
        error: "Method mismatch",
        registered: api.method,
        provided: method,
        message: "Provided method does not match registered API method"
      });
    }

    // Fetch latest metadata for validation
    const metadata = await apiService.getAIMetadata(apiId, 1);
    let validationWarnings = [];

    if (metadata && metadata.length > 0) {
      const latestMetadata = metadata[0];
      const recommendations = latestMetadata.ai_recommendations || {};

      // Check auth requirements
      if (recommendations.authorization_required && (!headers || !headers.Authorization)) {
        validationWarnings.push({
          type: 'auth_missing',
          message: 'This API requires authorization but no Authorization header provided',
          auth_type: recommendations.auth_type || 'Unknown'
        });
      }

      // Check required headers
      if (recommendations.required_headers && recommendations.required_headers.length > 0) {
        const missingHeaders = recommendations.required_headers.filter(
          h => !headers || !headers[h]
        );
        if (missingHeaders.length > 0) {
          validationWarnings.push({
            type: 'missing_headers',
            message: 'Missing recommended headers',
            missing: missingHeaders
          });
        }
      }

      // Check required params
      if (recommendations.required_params && recommendations.required_params.length > 0) {
        const missingParams = recommendations.required_params.filter(
          p => !params || !params[p]
        );
        if (missingParams.length > 0) {
          validationWarnings.push({
            type: 'missing_params',
            message: 'Missing recommended parameters',
            missing: missingParams
          });
        }
      }
    }

    // Execute API call
    const testResult = await apiTester.executeAPICall(api, {
      params: params || api.request_params || {},
      headers: headers || {}
    });

    // Store test result
    await apiService.storeTestResult({
      api_id: apiId,
      scenario_name: 'validated_execution',
      response_status: testResult.status,
      response_time: testResult.response_time,
      response_body: testResult.body,
      request_params: params || api.request_params || {},
      request_headers: headers || {},
      success: testResult.success,
      error_message: testResult.error || null
    });

    res.json({
      success: true,
      validation: {
        method: 'valid',
        warnings: validationWarnings
      },
      execution: {
        status: testResult.status,
        response_time: testResult.response_time,
        success: testResult.success,
        body: testResult.body
      },
      metadata_used: metadata && metadata.length > 0
    });
  } catch (error) {
    console.error('Error in validate and execute:', error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message
    });
  }
});

/**
 * POST /api/ai-query
 * Context-aware AI query processing
 */
router.post("/ai-query", async (req, res) => {
  try {
    const { query, context = {}, allAPIs = [] } = req.body;

    if (!query) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Query parameter is required"
      });
    }

    console.log(`💬 Processing context-aware query: ${query.substring(0, 50)}...`);

    // Fetch all APIs if not provided
    const apis = allAPIs.length > 0 ? allAPIs : await apiService.getAllAPIs({ limit: 10 });

    // Build conversation context
    let conversationHistory = '';
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      conversationHistory = '\n\nRecent Conversation:\n' +
        context.conversationHistory.map(msg => `${msg.role}: ${msg.content.substring(0, 100)}`).join('\n');
    }

    // Build current context info
    let currentContext = '';
    if (context.currentAPI) {
      const currentApi = apis.find(a => a.id === context.currentAPI);
      if (currentApi) {
        currentContext = `\n\nCurrent API in context: ${currentApi.name} (ID: ${currentApi.id}) - ${currentApi.method} ${currentApi.endpoint}`;
      }
    }
    if (context.lastAction) {
      currentContext += `\nLast action: ${context.lastAction}`;
    }
    if (context.recentAPIs && context.recentAPIs.length > 0) {
      const recentApiDetails = context.recentAPIs
        .map(id => apis.find(a => a.id === id))
        .filter(a => a)
        .map((a, i) => `${i + 1}. ${a.name} (ID: ${a.id})`);
      if (recentApiDetails.length > 0) {
        currentContext += `\nRecently mentioned:\n${recentApiDetails.join('\n')}`;
      }
    }

    // Build AI prompt with instructions
    const aiPrompt = `You are an AI assistant for API testing. Understand natural conversation and context references.

Available APIs:
${apis.map((api, i) => `${i + 1}. ${api.name} (ID: ${api.id}) - ${api.method} ${api.endpoint}`).join('\n')}
${currentContext}
${conversationHistory}

User: ${query}

Resolve references like "it", "that one", "the first/second one", "the GitHub API" using context.

If user wants to:
- Test/query an API → Respond: ACTION: query_with_summary | API_ID: X | EXPLANATION: brief text
- Validate an API → Respond: ACTION: validate | API_ID: X | EXPLANATION: brief text
- Get API details → Respond: ACTION: get_api_details | API_ID: X | EXPLANATION: brief text
- Get metadata → Respond: ACTION: get_metadata | API_ID: X | EXPLANATION: brief text
- General question → Respond normally

Response:`;

    const aiResponse = await multiModelService.generateCompletion('default', aiPrompt, {
      temperature: 0.7,
      maxTokens: 800
    });

    const content = aiResponse.content || aiResponse;

    // Parse for actions
    const actionMatch = content.match(/ACTION:\s*(\w+)/i);
    const apiIdMatch = content.match(/API_ID:\s*(\d+)/i);
    const explanationMatch = content.match(/EXPLANATION:\s*(.+?)(?:\n|$)/is);

    if (actionMatch && apiIdMatch) {
      const action = actionMatch[1].toLowerCase();
      const apiId = parseInt(apiIdMatch[1]);
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';

      console.log(`🎯 Action: ${action} for API ${apiId}`);

      let actionResult, actionType;

      try {
        const api = await apiService.getAPIById(apiId);
        if (!api) {
          return res.json({
            success: true,
            response: `I couldn't find API with ID ${apiId}.`,
            context: { currentAPI: context.currentAPI }
          });
        }

        if (action === 'query_with_summary') {
          // Build headers with auth if API requires it
          const headers = {};
          if (Boolean(api.auth_required) && api.auth_token) {
            if (api.auth_type === 'API Key') {
              headers['X-API-Key'] = api.auth_token;
              headers['Authorization'] = api.auth_token;
            } else if (api.auth_type === 'Basic Auth') {
              headers['Authorization'] = `Basic ${api.auth_token}`;
            } else {
              headers['Authorization'] = api.auth_token.startsWith('Bearer ') ? api.auth_token : `Bearer ${api.auth_token}`;
            }
            console.log(`🔐 Using stored auth token for ${api.name}`);
          }

          const testResult = await apiTester.executeAPICall(api, { params: {}, headers });
          const summaryPrompt = `Concise summary of API response:\nAPI: ${api.name}\nStatus: ${testResult.status}\nBody: ${JSON.stringify(testResult.body).substring(0, 500)}\n\nProvide brief analysis:`;
          const summaryResponse = await multiModelService.generateCompletion('default', summaryPrompt, {
            temperature: 0.3,
            maxTokens: 400
          });

          actionResult = {
            success: true,
            api_id: apiId,
            api_name: api.name,
            endpoint: api.endpoint,
            method: api.method,
            auth_used: Boolean(api.auth_required) && api.auth_token ? true : false,
            response: {
              status: testResult.status,
              response_time: testResult.response_time,
              body: testResult.body
            },
            ai_summary: summaryResponse.content || summaryResponse
          };
          actionType = 'query_with_summary';

        } else if (action === 'validate') {
          const metadata = await apiService.getAIMetadata(apiId, 1);
          let validationWarnings = [];
          if (metadata && metadata.length > 0) {
            const rec = metadata[0].ai_recommendations || {};
            if (rec.authorization_required) {
              validationWarnings.push({
                type: 'auth_missing',
                message: 'This API requires authorization',
                auth_type: rec.auth_type || 'Unknown'
              });
            }
          }

          // Build headers with auth if API requires it
          const headers = {};
          if (Boolean(api.auth_required) && api.auth_token) {
            if (api.auth_type === 'API Key') {
              headers['X-API-Key'] = api.auth_token;
              headers['Authorization'] = api.auth_token;
            } else if (api.auth_type === 'Basic Auth') {
              headers['Authorization'] = `Basic ${api.auth_token}`;
            } else {
              // Bearer Token or OAuth
              headers['Authorization'] = api.auth_token.startsWith('Bearer ') ? api.auth_token : `Bearer ${api.auth_token}`;
            }
            console.log(`🔐 Using stored auth token for validation: ${api.name}`);
          }

          const testResult = await apiTester.executeAPICall(api, { params: {}, headers });
          await apiService.storeTestResult({
            api_id: apiId,
            scenario_name: 'context_validation',
            response_status: testResult.status,
            response_time: testResult.response_time,
            response_body: testResult.body,
            request_params: {},
            request_headers: headers,
            success: testResult.success,
            error_message: testResult.error || null
          });

          actionResult = {
            success: true,
            validation: { method: 'valid', warnings: validationWarnings },
            execution: {
              status: testResult.status,
              response_time: testResult.response_time,
              success: testResult.success,
              body: testResult.body,
              auth_used: Boolean(api.auth_required) && api.auth_token ? true : false
            }
          };
          actionType = 'validate';

        } else if (action === 'get_api_details') {
          actionResult = { api };
          actionType = 'get_api';

        } else if (action === 'get_metadata') {
          const metadata = await apiService.getAIMetadata(apiId, 5);
          actionResult = { success: true, api_id: apiId, metadata };
          actionType = 'metadata';
        }

        return res.json({
          success: true,
          query,
          response: explanation || content,
          action: actionType,
          data: actionResult,
          context: {
            currentAPI: apiId,
            apiId: apiId,
            action: action
          },
          model_used: aiResponse.provider || 'default'
        });

      } catch (actionError) {
        console.error(`Error ${action}:`, actionError);
        return res.json({
          success: true,
          response: `I tried to ${action} but encountered an error: ${actionError.message}`,
          context: { currentAPI: apiId }
        });
      }
    }

    // Conversational response
    res.json({
      success: true,
      query,
      response: content,
      context: {
        currentAPI: context.currentAPI,
        lastAction: context.lastAction
      },
      model_used: aiResponse.provider || 'default'
    });

  } catch (error) {
    return handleError(res, error, 'AI Query Error');
  }
});

export default router;
