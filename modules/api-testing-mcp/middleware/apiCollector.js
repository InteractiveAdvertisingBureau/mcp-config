// API Metadata Collector Middleware
// Collects API information and AI-generated metadata, stores in database

import * as apiService from '../services/apiService.js';
import { multiModelService } from '../services/multiModelService.js';

/**
 * Collect and store API metadata with AI analysis
 */
export async function collectAPIMetadata(apiData, testResults) {
  try {
    console.error(`📊 Collecting metadata for API: ${apiData.name || apiData.endpoint}`);

    // Generate AI summary of the API and test results
    const aiAnalysis = await generateAISummary(apiData, testResults);

    // Store AI metadata in database including auth requirements
    const metadataId = await apiService.storeAIMetadata({
      api_id: apiData.id,
      test_result_id: testResults.length > 0 ? testResults[0].id : null,
      ai_summary: aiAnalysis.summary,
      ai_recommendations: {
        ...aiAnalysis.recommendations,
        authorization_required: aiAnalysis.authorization_required || false,
        auth_type: aiAnalysis.auth_type || 'None',
        required_headers: aiAnalysis.required_headers || [],
        required_params: aiAnalysis.required_params || []
      },
      validation_result: aiAnalysis.validation,
      risk_assessment: aiAnalysis.risk_assessment,
      performance_notes: aiAnalysis.performance_notes,
      model_used: aiAnalysis.model_used
    });

    console.error(`✅ AI metadata stored with ID: ${metadataId}`);

    return {
      metadata_id: metadataId,
      ai_analysis: aiAnalysis
    };
  } catch (error) {
    console.error('❌ Error collecting API metadata:', error.message);
    throw error;
  }
}

/**
 * Generate AI summary and analysis of API test results
 */
async function generateAISummary(apiData, testResults) {
  try {
    // Prepare data for AI analysis
    const successCount = testResults.filter(r => r.success).length;
    const failCount = testResults.length - successCount;
    const avgResponseTime = testResults.length > 0
      ? testResults.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / testResults.length
      : 0;

    // Detect patterns from test results
    const has401 = testResults.some(r => r.response_status === 401);
    const has403 = testResults.some(r => r.response_status === 403);
    const authRelatedErrors = testResults.some(r =>
      r.error_message?.toLowerCase().includes('auth') ||
      r.error_message?.toLowerCase().includes('unauthorized')
    );

    const prompt = `
Analyze this API and its test results to determine requirements and patterns:

API Details:
- Name: ${apiData.name}
- Endpoint: ${apiData.endpoint}
- Method: ${apiData.method}
- Request Type: ${apiData.request_type}

Test Results Summary:
- Total Tests: ${testResults.length}
- Successful: ${successCount}
- Failed: ${failCount}
- Average Response Time: ${avgResponseTime.toFixed(2)}ms

Recent Test Details:
${testResults.slice(0, 3).map((r, i) => `
Test ${i + 1}:
- Scenario: ${r.scenario_name}
- Status: ${r.response_status || 'N/A'}
- Success: ${r.success ? 'Yes' : 'No'}
- Response Time: ${r.response_time_ms || 'N/A'}ms
- Error: ${r.error_message || 'None'}
`).join('\n')}

IMPORTANT: Based on the test results, detect patterns:
- If any test returned 401 or 403, this API REQUIRES authorization
- If certain parameters caused failures, identify required parameters
- Determine what headers or authentication methods are needed

Please provide:
1. A brief summary of the API's behavior and reliability
2. Does this API require authorization? (detect from 401/403 responses)
3. What authentication method does it likely use? (Bearer token, API key, etc.)
4. Required parameters or headers for successful requests
5. Recommendations for improving the API or its testing
6. Validation assessment (are the responses valid and expected?)
7. Risk assessment (any security or performance concerns?)
8. Performance notes (response time analysis)

Respond in JSON format:
{
  "summary": "brief summary here",
  "authorization_required": true/false,
  "auth_type": "Bearer Token|API Key|Basic Auth|OAuth|None",
  "required_headers": ["Authorization", "API-Key"],
  "required_params": ["param1", "param2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "validation": {"status": "valid/invalid/partial", "issues": []},
  "risk_assessment": "risk analysis here",
  "performance_notes": "performance analysis here"
}
`;

    // Use multiModelService to get AI analysis
    const response = await multiModelService.generateCompletion('default', prompt, {
      temperature: 0.3,
      maxTokens: 1000
    });

    // Try to parse JSON response
    let analysis;
    try {
      // Extract content from response
      const content = response.content || response;
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, content];
      analysis = JSON.parse(jsonMatch[1] || content);
    } catch (parseError) {
      console.warn('⚠️ Failed to parse AI response as JSON, using raw text');
      analysis = {
        summary: response,
        recommendations: [],
        validation: { status: 'unknown', issues: [] },
        risk_assessment: 'Could not parse AI analysis',
        performance_notes: `Average response time: ${avgResponseTime.toFixed(2)}ms`
      };
    }

    return {
      ...analysis,
      model_used: response.provider || 'default'
    };
  } catch (error) {
    console.error('❌ Error generating AI summary:', error.message);
    return {
      summary: 'AI analysis unavailable',
      recommendations: [],
      validation: { status: 'unknown', issues: ['AI analysis failed'] },
      risk_assessment: 'Unable to assess',
      performance_notes: 'Unable to analyze',
      model_used: 'none',
      error: error.message
    };
  }
}

/**
 * Middleware to log API requests and responses
 */
export async function logAPIActivity(apiId, requestData, responseData, startTime) {
  try {
    const duration = Date.now() - startTime;

    await apiService.logAPIRequest({
      api_id: apiId,
      request_method: requestData.method,
      request_url: requestData.url,
      request_headers: requestData.headers,
      request_body: requestData.body,
      response_status: responseData.status,
      response_body: responseData.body,
      response_headers: responseData.headers,
      duration_ms: duration,
      error: responseData.error || null
    });

    console.error(`📝 API activity logged for API ID: ${apiId} (${duration}ms)`);
  } catch (error) {
    console.error('❌ Error logging API activity:', error.message);
    // Don't throw error - logging failure shouldn't break the flow
  }
}

/**
 * Analyze API response and validate
 */
export function validateAPIResponse(response, expectedSchema = null) {
  const validation = {
    is_valid: true,
    issues: [],
    warnings: []
  };

  // Check HTTP status
  if (response.status >= 400) {
    validation.is_valid = false;
    validation.issues.push(`HTTP error: ${response.status}`);
  }

  // Check response time
  if (response.response_time_ms > 5000) {
    validation.warnings.push('Response time exceeds 5 seconds');
  }

  // Check for empty response
  if (!response.response_body || response.response_body.trim() === '') {
    validation.warnings.push('Empty response body');
  }

  // Try to parse JSON if content-type is JSON
  if (response.response_headers &&
      response.response_headers['content-type']?.includes('application/json')) {
    try {
      JSON.parse(response.response_body);
    } catch (e) {
      validation.is_valid = false;
      validation.issues.push('Invalid JSON response');
    }
  }

  // TODO: Add schema validation if expectedSchema is provided

  return validation;
}
