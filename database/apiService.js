// API Database Service - CRUD operations for registered APIs
import { query, queryOne } from './connection.js';

/**
 * Mask sensitive auth token in API object
 * @param {Object} api - API object
 * @param {Boolean} includeToken - Whether to include the actual token (for internal use)
 * @returns {Object} API object with masked token
 */
function maskAuthToken(api, includeToken = false) {
  if (!api) return api;

  // If includeToken is true, return as-is (for internal API execution)
  if (includeToken) return api;

  // Mask the token for external responses
  if (api.auth_token) {
    api.auth_token = null; // Hide token completely
  }

  return api;
}

/**
 * Mask auth tokens in array of APIs
 */
function maskAuthTokens(apis, includeToken = false) {
  if (!Array.isArray(apis)) return apis;
  return apis.map(api => maskAuthToken(api, includeToken));
}

/**
 * Register a new API
 */
export async function registerAPI(apiData) {
  const sql = `
    INSERT INTO registered_apis
    (name, endpoint, method, request_type, request_params, description, auth_required, auth_type, auth_token, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Handle request_params - avoid double stringification
  const requestParams = apiData.request_params || {};
  const requestParamsStr = typeof requestParams === 'string' ? requestParams : JSON.stringify(requestParams);

  const params = [
    apiData.name || 'Unnamed API',
    apiData.endpoint,
    apiData.method?.toUpperCase() || 'GET',
    apiData.request_type || 'application/json',
    requestParamsStr,
    apiData.description || '',
    apiData.auth_required || false,
    apiData.auth_type || null,
    apiData.auth_token || null,
    'active'
  ];

  const result = await query(sql, params);

  // Fetch and return the newly created API
  return await getAPIById(result.insertId);
}

/**
 * Get API by ID
 * @param {Number} apiId - API ID
 * @param {Boolean} includeToken - Whether to include auth token (default: false for security)
 */
export async function getAPIById(apiId, includeToken = false) {
  const sql = `
    SELECT
      id,
      name,
      endpoint,
      method,
      request_type,
      request_params,
      description,
      auth_required,
      auth_type,
      auth_token,
      status,
      created_at,
      updated_at
    FROM registered_apis
    WHERE id = ?
  `;

  const api = await queryOne(sql, [apiId]);

  if (api && api.request_params) {
    try {
      // Check if already parsed (object) or needs parsing (string)
      if (typeof api.request_params === 'string') {
        api.request_params = JSON.parse(api.request_params);
      }
    } catch (e) {
      console.error(`Failed to parse request_params for API ${apiId}:`, e.message);
      api.request_params = {};
    }
  }

  // Mask token unless explicitly requested for internal use
  return maskAuthToken(api, includeToken);
}

/**
 * Get all registered APIs
 * @param {Object} filters - Filter options
 * @param {Boolean} includeToken - Whether to include auth tokens (default: false for security)
 */
export async function getAllAPIs(filters = {}, includeToken = false) {
  let sql = `
    SELECT
      id,
      name,
      endpoint,
      method,
      request_type,
      request_params,
      description,
      auth_required,
      auth_type,
      auth_token,
      status,
      created_at,
      updated_at
    FROM registered_apis
    WHERE 1=1
  `;

  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.method) {
    sql += ' AND method = ?';
    params.push(filters.method.toUpperCase());
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    const limit = parseInt(filters.limit);
    sql += ` LIMIT ${limit}`;
  }

  const apis = await query(sql, params);

  // Parse JSON fields
  const parsedApis = apis.map(api => ({
    ...api,
    request_params: typeof api.request_params === 'string'
      ? JSON.parse(api.request_params)
      : api.request_params
  }));

  // Mask tokens unless explicitly requested for internal use
  return maskAuthTokens(parsedApis, includeToken);
}

/**
 * Update API
 */
export async function updateAPI(apiId, updates) {
  const allowedFields = ['name', 'endpoint', 'method', 'request_type', 'request_params', 'description', 'status', 'auth_required', 'auth_type', 'auth_token'];
  const setClauses = [];
  const params = [];

  // Get existing API to preserve auth token if not provided
  const existingApi = await getAPIById(apiId, true); // Include token for internal use

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      // Handle request_params - check if already stringified
      if (key === 'request_params') {
        const paramValue = typeof value === 'string' ? value : JSON.stringify(value);
        setClauses.push(`${key} = ?`);
        params.push(paramValue);
      }
      // Handle auth_token - preserve existing if not provided or empty
      else if (key === 'auth_token') {
        if (value === null || value === undefined || value === '') {
          // Preserve existing token if update value is empty
          if (existingApi && existingApi.auth_token) {
            setClauses.push(`${key} = ?`);
            params.push(existingApi.auth_token);
          }
          // If no existing token and no new token, explicitly set to null
          else {
            setClauses.push(`${key} = ?`);
            params.push(null);
          }
        } else {
          // New token provided
          setClauses.push(`${key} = ?`);
          params.push(value);
        }
      }
      // Handle other fields normally
      else {
        setClauses.push(`${key} = ?`);
        params.push(value);
      }
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }

  params.push(apiId);

  const sql = `
    UPDATE registered_apis
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `;

  await query(sql, params);
  return await getAPIById(apiId);
}

/**
 * Delete API
 */
export async function deleteAPI(apiId) {
  const sql = 'DELETE FROM registered_apis WHERE id = ?';
  const result = await query(sql, [apiId]);
  return result.affectedRows > 0;
}

/**
 * Store test result
 */
export async function storeTestResult(testData) {
  const sql = `
    INSERT INTO api_test_results
    (api_id, scenario_name, test_params, response_status, response_time_ms,
     response_body, response_headers, success, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    testData.api_id,
    testData.scenario_name || 'default',
    JSON.stringify(testData.test_params || {}),
    testData.response_status || null,
    testData.response_time_ms || null,
    testData.response_body || null,
    JSON.stringify(testData.response_headers || {}),
    testData.success || false,
    testData.error_message || null
  ];

  const result = await query(sql, params);
  return result.insertId;
}

/**
 * Get test results for an API
 */
export async function getTestResults(apiId, limit = 10) {
  const limitNum = parseInt(limit);
  const sql = `
    SELECT
      id,
      api_id,
      scenario_name,
      test_params,
      response_status,
      response_time_ms,
      response_body,
      response_headers,
      success,
      error_message,
      tested_at
    FROM api_test_results
    WHERE api_id = ?
    ORDER BY tested_at DESC
    LIMIT ${limitNum}
  `;

  const results = await query(sql, [apiId]);

  // Parse JSON fields
  return results.map(result => ({
    ...result,
    test_params: typeof result.test_params === 'string'
      ? JSON.parse(result.test_params)
      : result.test_params,
    response_headers: typeof result.response_headers === 'string'
      ? JSON.parse(result.response_headers)
      : result.response_headers
  }));
}

/**
 * Store AI metadata
 */
export async function storeAIMetadata(metadataData) {
  const sql = `
    INSERT INTO api_ai_metadata
    (api_id, test_result_id, ai_summary, ai_recommendations,
     validation_result, risk_assessment, performance_notes, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    metadataData.api_id,
    metadataData.test_result_id || null,
    metadataData.ai_summary || null,
    JSON.stringify(metadataData.ai_recommendations || {}),
    JSON.stringify(metadataData.validation_result || {}),
    metadataData.risk_assessment || null,
    metadataData.performance_notes || null,
    metadataData.model_used || 'unknown'
  ];

  const result = await query(sql, params);
  return result.insertId;
}

/**
 * Get AI metadata for an API
 */
export async function getAIMetadata(apiId, limit = 5) {
  const limitNum = parseInt(limit);
  const sql = `
    SELECT
      id,
      api_id,
      test_result_id,
      ai_summary,
      ai_recommendations,
      validation_result,
      risk_assessment,
      performance_notes,
      model_used,
      generated_at
    FROM api_ai_metadata
    WHERE api_id = ?
    ORDER BY generated_at DESC
    LIMIT ${limitNum}
  `;

  const results = await query(sql, [apiId]);

  // Parse JSON fields
  return results.map(meta => ({
    ...meta,
    ai_recommendations: typeof meta.ai_recommendations === 'string'
      ? JSON.parse(meta.ai_recommendations)
      : meta.ai_recommendations,
    validation_result: typeof meta.validation_result === 'string'
      ? JSON.parse(meta.validation_result)
      : meta.validation_result
  }));
}

/**
 * Get API statistics
 */
export async function getAPIStatistics(apiId) {
  const sql = `
    SELECT * FROM api_statistics WHERE id = ?
  `;

  return await queryOne(sql, [apiId]);
}

/**
 * Get all API statistics
 */
export async function getAllAPIStatistics() {
  const sql = `
    SELECT * FROM api_statistics ORDER BY last_tested_at DESC
  `;

  return await query(sql);
}

/**
 * Log API request/response
 */
export async function logAPIRequest(logData) {
  const sql = `
    INSERT INTO api_logs
    (api_id, request_method, request_url, request_headers, request_body,
     response_status, response_body, response_headers, duration_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    logData.api_id,
    logData.request_method || 'GET',
    logData.request_url,
    JSON.stringify(logData.request_headers || {}),
    logData.request_body || null,
    logData.response_status || null,
    logData.response_body || null,
    JSON.stringify(logData.response_headers || {}),
    logData.duration_ms || null,
    logData.error || null
  ];

  const result = await query(sql, params);
  return result.insertId;
}
