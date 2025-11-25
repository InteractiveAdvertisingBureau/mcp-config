// API Testing Tool - Test APIs with multiple scenarios
import axios from 'axios';
import * as apiService from '../database/apiService.js';
import { collectAPIMetadata, validateAPIResponse } from '../middleware/apiCollector.js';

/**
 * Test API with multiple scenarios
 */
export async function testAPIWithScenarios(apiId, scenarios = []) {
  try {
    console.log(`🧪 Testing API ID: ${apiId} with ${scenarios.length} scenarios`);

    // Get API details from database
    const api = await apiService.getAPIById(apiId);
    if (!api) {
      throw new Error(`API not found: ${apiId}`);
    }

    // If no scenarios provided, create a default one
    if (scenarios.length === 0) {
      scenarios = [{
        name: 'default',
        params: api.request_params || {},
        headers: { 'Content-Type': api.request_type }
      }];
    }

    const testResults = [];

    // Run each scenario
    for (const scenario of scenarios) {
      const result = await runTestScenario(api, scenario);

      // Store test result in database
      const testResultId = await apiService.storeTestResult({
        api_id: apiId,
        scenario_name: scenario.name,
        test_params: scenario.params,
        response_status: result.status,
        response_time_ms: result.response_time,
        response_body: result.body ? JSON.stringify(result.body).substring(0, 10000) : null,
        response_headers: result.headers,
        success: result.success,
        error_message: result.error
      });

      testResults.push({
        id: testResultId,
        scenario_name: scenario.name,
        ...result
      });
    }

    // Collect AI metadata for the test results
    const metadata = await collectAPIMetadata(api, testResults);

    return {
      api_id: apiId,
      api_name: api.name,
      api_endpoint: api.endpoint,
      total_scenarios: scenarios.length,
      successful_tests: testResults.filter(r => r.success).length,
      failed_tests: testResults.filter(r => !r.success).length,
      test_results: testResults,
      ai_analysis: metadata.ai_analysis
    };
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    throw error;
  }
}

/**
 * Run a single test scenario
 */
async function runTestScenario(api, scenario) {
  const startTime = Date.now();
  const result = {
    success: false,
    status: null,
    response_time: 0,
    body: null,
    headers: null,
    error: null
  };

  try {
    // Prepare request config
    const config = {
      method: api.method.toLowerCase(),
      url: api.endpoint,
      headers: {
        'Content-Type': api.request_type,
        ...(scenario.headers || {})
      },
      timeout: 30000, // 30 second timeout
      validateStatus: () => true // Don't throw on any status code
    };

    // Add request body/params based on method
    if (['post', 'put', 'patch'].includes(config.method)) {
      config.data = scenario.params || api.request_params;
    } else if (['get', 'delete'].includes(config.method)) {
      config.params = scenario.params || api.request_params;
    }

    console.log(`🔍 Testing ${api.method} ${api.endpoint} (${scenario.name})`);

    // Execute request
    const response = await axios(config);

    result.response_time = Date.now() - startTime;
    result.status = response.status;
    result.headers = response.headers;
    result.body = response.data;
    result.success = response.status >= 200 && response.status < 400;

    console.log(`${result.success ? '✅' : '❌'} Test completed: ${response.status} (${result.response_time}ms)`);

  } catch (error) {
    result.response_time = Date.now() - startTime;
    result.error = error.message;
    result.success = false;

    if (error.response) {
      // Server responded with error status
      result.status = error.response.status;
      result.headers = error.response.headers;
      result.body = error.response.data;
    } else if (error.request) {
      // Request made but no response
      result.error = 'No response from server: ' + error.message;
    } else {
      // Error setting up request
      result.error = 'Request setup failed: ' + error.message;
    }

    console.log(`❌ Test failed: ${result.error} (${result.response_time}ms)`);
  }

  return result;
}

/**
 * Test API immediately without storing (for preview/validation)
 */
export async function testAPIPreview(apiData) {
  try {
    console.log(`👁️ Preview test for: ${apiData.endpoint}`);

    const scenario = {
      name: 'preview',
      params: apiData.request_params || {},
      headers: { 'Content-Type': apiData.request_type || 'application/json' }
    };

    const result = await runTestScenario(apiData, scenario);

    return {
      endpoint: apiData.endpoint,
      method: apiData.method,
      success: result.success,
      status: result.status,
      response_time: result.response_time,
      error: result.error,
      preview: true
    };
  } catch (error) {
    console.error('❌ Error in preview test:', error.message);
    throw error;
  }
}

/**
 * Generate test scenarios automatically based on API definition and learned patterns
 * @param {Object} api - API configuration
 * @param {Object} metadata - Optional metadata from previous tests (auth requirements, etc.)
 */
export function generateTestScenarios(api, metadata = null) {
  const scenarios = [];

  // Extract auth requirements from metadata if available
  const authRequired = metadata?.authorization_required || false;
  const authType = metadata?.auth_type || 'Bearer Token';
  const requiredHeaders = metadata?.required_headers || [];
  const requiredParams = metadata?.required_params || [];

  // Base headers
  const baseHeaders = { 'Content-Type': api.request_type };

  // If auth is required, include it in scenarios
  const authHeaders = authRequired ? {
    'Authorization': authType === 'API Key' ? 'YOUR_API_KEY_HERE' : 'Bearer YOUR_TOKEN_HERE'
  } : {};

  // Add any other required headers from metadata
  requiredHeaders.forEach(header => {
    if (header !== 'Authorization' && !authHeaders[header]) {
      authHeaders[header] = 'PLACEHOLDER_VALUE';
    }
  });

  console.log(`🔧 Generating scenarios - Auth Required: ${authRequired}, Type: ${authType}`);

  // Scenario 1: Default/Happy path (with auth if required)
  scenarios.push({
    name: 'default',
    description: authRequired ? 'Default test with authentication' : 'Default parameters test',
    params: api.request_params || {},
    headers: { ...baseHeaders, ...authHeaders }
  });

  // Scenario 2: Without auth (to test if auth is truly required)
  // Only add this if we detected auth was required, to verify the requirement
  if (authRequired) {
    scenarios.push({
      name: 'no_auth',
      description: 'Test without authentication (should fail)',
      params: api.request_params || {},
      headers: baseHeaders
    });
  }

  // Scenario 3: Empty parameters (with auth if required)
  if (api.method !== 'GET' && !authRequired) {
    scenarios.push({
      name: 'empty_params',
      description: 'Test with empty parameters',
      params: {},
      headers: { ...baseHeaders, ...authHeaders }
    });
  }

  // Scenario 4: Different content types (if applicable)
  if (['POST', 'PUT', 'PATCH'].includes(api.method) && !authRequired) {
    scenarios.push({
      name: 'form_data',
      description: 'Test with form data content type',
      params: api.request_params || {},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...authHeaders
      }
    });
  }

  // Scenario 5: Test auth if not previously detected (discovery mode)
  if (!authRequired) {
    scenarios.push({
      name: 'with_auth',
      description: 'Test with authorization header to detect if needed',
      params: api.request_params || {},
      headers: {
        ...baseHeaders,
        'Authorization': 'Bearer token_placeholder'
      }
    });
  }

  console.log(`✅ Generated ${scenarios.length} intelligent test scenarios`);
  return scenarios;
}

/**
 * Batch test multiple APIs
 */
export async function batchTestAPIs(apiIds, scenarios = []) {
  const results = [];

  for (const apiId of apiIds) {
    try {
      const result = await testAPIWithScenarios(apiId, scenarios);
      results.push(result);
    } catch (error) {
      results.push({
        api_id: apiId,
        error: error.message,
        success: false
      });
    }
  }

  return {
    total_tested: apiIds.length,
    successful: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results
  };
}
