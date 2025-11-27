// API Testing System - Frontend Application
const API_BASE = '/api';
let currentAPIs = [];
let currentScenarios = [];

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadAPIs();
    initializeQueryTab();
});

function initializeApp() {
    console.log('API Testing System initialized');
    // Check backend connectivity
    checkHealth();
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            console.log('Backend connected');
        }
    } catch (error) {
        showToast('Backend connection failed', 'error');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', handleRegisterAPI);
    document.getElementById('testBeforeRegister').addEventListener('click', testBeforeRegister);

    // API list filters
    document.getElementById('searchAPIs').addEventListener('input', filterAPIs);
    document.getElementById('filterMethod').addEventListener('change', filterAPIs);
    document.getElementById('filterStatus').addEventListener('change', filterAPIs);

    // Test tab
    document.getElementById('testApiSelect').addEventListener('change', handleTestAPISelect);
    document.getElementById('addScenarioBtn').addEventListener('click', addScenario);
    document.getElementById('runTestBtn').addEventListener('click', runTests);
    document.getElementById('autoGenerateScenariosBtn').addEventListener('click', autoGenerateScenarios);

    // Temporary token input - save on change with debounce
    let tokenSaveTimeout;
    document.getElementById('tempTokenInput').addEventListener('input', (e) => {
        clearTimeout(tokenSaveTimeout);
        tokenSaveTimeout = setTimeout(() => {
            const apiId = document.getElementById('testApiSelect').value;
            if (apiId) {
                saveTempToken(apiId, e.target.value);
                // Update scenarios with new token
                if (currentScenarios.length > 0) {
                    renderScenarios();
                }
            }
        }, 500); // Save after 500ms of no typing
    });

    // Results tab
    document.getElementById('resultsApiSelect').addEventListener('change', loadTestResults);

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadAPIs();
        showToast('Refreshed', 'success');
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') closeModal();
    });
}

// ============================================
// Tab Navigation
// ============================================

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-content`).classList.add('active');

    // Load data for specific tabs
    if (tabName === 'apis') {
        loadAPIs();
    } else if (tabName === 'test') {
        loadAPIsForTesting();
    } else if (tabName === 'results') {
        loadAPIsForResults();
    } else if (tabName === 'statistics') {
        loadStatistics();
    } else if (tabName === 'query') {
        renderChatMessages();
    }
}

// ============================================
// API Registration
// ============================================

// ============================================
// Parameter Builder Functions
// ============================================

let parameterCounter = 0;

function addParameterField() {
    const container = document.getElementById('parametersBuilder');
    const paramId = `param-${Date.now()}-${parameterCounter++}`;

    const paramRow = document.createElement('div');
    paramRow.className = 'parameter-row';
    paramRow.id = paramId;
    paramRow.innerHTML = `
        <div class="parameter-field">
            <label>Parameter Name</label>
            <input type="text" class="param-name" placeholder="e.g., userId, email" required>
        </div>
        <div class="parameter-field">
            <label>Location</label>
            <select class="param-location">
                <option value="body">Body (JSON)</option>
                <option value="query">Query String</option>
                <option value="path">Path Parameter</option>
                <option value="header">Header</option>
            </select>
        </div>
        <div class="parameter-field">
            <label>Type</label>
            <select class="param-type">
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="object">Object</option>
                <option value="array">Array</option>
            </select>
        </div>
        <div class="parameter-field">
            <label>Sample Value</label>
            <input type="text" class="param-sample" placeholder="e.g., 123, test@email.com">
        </div>
        <button type="button" class="remove-param-btn" onclick="removeParameterField('${paramId}')" title="Remove parameter">
            ×
        </button>
    `;

    container.appendChild(paramRow);
}

function removeParameterField(paramId) {
    const element = document.getElementById(paramId);
    if (element) {
        element.remove();
    }
}

function collectParameters() {
    const container = document.getElementById('parametersBuilder');
    const paramRows = container.querySelectorAll('.parameter-row');

    const parameters = {
        body: {},
        query: {},
        path: {},
        headers: {}
    };

    const metadata = [];

    paramRows.forEach(row => {
        const name = row.querySelector('.param-name').value.trim();
        const location = row.querySelector('.param-location').value;
        const type = row.querySelector('.param-type').value;
        const sample = row.querySelector('.param-sample').value.trim();

        if (!name) return; // Skip empty names

        // Convert sample value based on type
        let value = sample || getDefaultValue(type);
        if (type === 'number') {
            value = sample ? parseFloat(sample) : 0;
        } else if (type === 'boolean') {
            value = sample ? sample.toLowerCase() === 'true' : false;
        } else if (type === 'object') {
            try {
                value = sample ? JSON.parse(sample) : {};
            } catch (e) {
                value = {};
            }
        } else if (type === 'array') {
            try {
                value = sample ? JSON.parse(sample) : [];
            } catch (e) {
                value = [];
            }
        }

        // Store parameter in appropriate location
        if (location === 'body') {
            parameters.body[name] = value;
        } else if (location === 'query') {
            parameters.query[name] = value;
        } else if (location === 'path') {
            parameters.path[name] = value;
        } else if (location === 'header') {
            parameters.headers[name] = value;
        }

        // Store metadata
        metadata.push({ name, location, type, sample: sample || value });
    });

    return { parameters, metadata };
}

function getDefaultValue(type) {
    switch (type) {
        case 'string': return '';
        case 'number': return 0;
        case 'boolean': return false;
        case 'object': return {};
        case 'array': return [];
        default: return '';
    }
}

function toggleAuthFields() {
    const requiresAuth = document.getElementById('apiRequiresAuth').value === 'true';
    const authTypeField = document.getElementById('apiAuthType');
    const authTokenGroup = document.getElementById('authTokenGroup');

    authTypeField.disabled = !requiresAuth;
    authTokenGroup.style.display = requiresAuth ? 'block' : 'none';
}

async function handleRegisterAPI(e) {
    e.preventDefault();

    const requiresAuth = document.getElementById('apiRequiresAuth').value === 'true';
    const authType = document.getElementById('apiAuthType').value;
    const authToken = document.getElementById('apiAuthToken').value;

    // Collect parameters from builder
    const { parameters, metadata } = collectParameters();

    const formData = {
        name: document.getElementById('apiName').value,
        endpoint: document.getElementById('apiEndpoint').value,
        method: document.getElementById('apiMethod').value,
        request_type: document.getElementById('apiRequestType').value,
        description: document.getElementById('apiDescription').value,
        auth_required: requiresAuth,
        auth_type: requiresAuth ? authType : null,
        auth_token: requiresAuth && authToken ? authToken : null
    };

    // Store all parameter locations (body, query, path, headers)
    formData.request_params = {
        body: parameters.body,
        query: parameters.query,
        path: parameters.path,
        headers: parameters.headers
    };

    console.log('📋 Registering API with parameters:', formData.request_params);

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            showToast('API registered successfully!', 'success');
            document.getElementById('registerForm').reset();
            // Clear parameter builder
            document.getElementById('parametersBuilder').innerHTML = '';
            parameterCounter = 0;
            loadAPIs();
            switchTab('apis');
        } else {
            showToast(result.message || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Error registering API: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function testBeforeRegister() {
    showToast('Testing API endpoint...', 'info');
    // Could implement a quick test here
    showToast('Quick test feature coming soon', 'info');
}

// ============================================
// API List Management
// ============================================

async function loadAPIs() {
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/apis`);
        const result = await response.json();

        if (result.success) {
            currentAPIs = result.apis;
            renderAPIs(currentAPIs);
        } else {
            showToast('Failed to load APIs', 'error');
        }
    } catch (error) {
        showToast('Error loading APIs: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderAPIs(apis) {
    const container = document.getElementById('apisList');
    const emptyState = document.getElementById('apisEmpty');

    if (apis.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = apis.map(api => `
        <div class="api-card" data-id="${api.id}">
            <div class="api-card-header">
                <div class="api-card-title">${escapeHtml(api.name)}</div>
                <span class="api-badge badge-${api.method}">${api.method}</span>
            </div>
            <div class="api-card-endpoint">${escapeHtml(api.endpoint)}</div>
            ${api.description ? `<p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${escapeHtml(api.description)}</p>` : ''}
            <div class="api-card-meta">
                <span>Created: ${formatDate(api.created_at)}</span>
                <div class="api-card-actions">
                    <button onclick="viewAPI(${api.id})">View</button>
                    <button onclick="testAPI(${api.id})">Test</button>
                    <button onclick="editAPI(${api.id})">Edit</button>
                    <button class="delete" onclick="deleteAPI(${api.id})">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterAPIs() {
    const search = document.getElementById('searchAPIs').value.toLowerCase();
    const method = document.getElementById('filterMethod').value;
    const status = document.getElementById('filterStatus').value;

    const filtered = currentAPIs.filter(api => {
        const matchesSearch = api.name.toLowerCase().includes(search) ||
                            api.endpoint.toLowerCase().includes(search);
        const matchesMethod = !method || api.method === method;
        const matchesStatus = !status || api.status === status;
        return matchesSearch && matchesMethod && matchesStatus;
    });

    renderAPIs(filtered);
}

// ============================================
// API Actions
// ============================================

function viewAPI(id) {
    const api = currentAPIs.find(a => a.id === id);
    if (!api) return;

    const content = `
        <div style="margin-bottom: 1rem;">
            <strong>Name:</strong> ${escapeHtml(api.name)}<br>
            <strong>Method:</strong> <span class="api-badge badge-${api.method}">${api.method}</span><br>
            <strong>Endpoint:</strong> <code>${escapeHtml(api.endpoint)}</code><br>
            <strong>Content Type:</strong> ${escapeHtml(api.request_type)}<br>
            <strong>Status:</strong> ${api.status}<br>
            <strong>Created:</strong> ${formatDate(api.created_at)}<br>
        </div>
        <div>
            <strong>Request Parameters:</strong>
            <pre>${JSON.stringify(api.request_params, null, 2)}</pre>
        </div>
        ${api.description ? `<div><strong>Description:</strong><p>${escapeHtml(api.description)}</p></div>` : ''}
    `;

    showModal('API Details', content);
}

function testAPI(id) {
    switchTab('test');
    document.getElementById('testApiSelect').value = id;
    handleTestAPISelect();
}

function editAPI(id) {
    const api = currentAPIs.find(a => a.id === id);
    if (!api) return;

    // Switch to register tab and populate form
    switchTab('register');
    document.getElementById('apiName').value = api.name;
    document.getElementById('apiEndpoint').value = api.endpoint;
    document.getElementById('apiMethod').value = api.method;
    document.getElementById('apiRequestType').value = api.request_type;
    document.getElementById('apiParams').value = JSON.stringify(api.request_params, null, 2);
    document.getElementById('apiDescription').value = api.description || '';

    showToast('Edit mode - Update the form and register again', 'info');
}

async function deleteAPI(id) {
    if (!confirm('Are you sure you want to delete this API and all its test results?')) {
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/apis/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('API deleted successfully', 'success');
            loadAPIs();
        } else {
            showToast('Failed to delete API', 'error');
        }
    } catch (error) {
        showToast('Error deleting API: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// Testing
// ============================================

async function loadAPIsForTesting() {
    const select = document.getElementById('testApiSelect');
    select.innerHTML = '<option value="">-- Select an API to test --</option>';

    if (currentAPIs.length === 0) {
        await loadAPIs();
    }

    currentAPIs.forEach(api => {
        const option = document.createElement('option');
        option.value = api.id;
        option.textContent = `${api.name} (${api.method})`;
        select.appendChild(option);
    });
}

function handleTestAPISelect() {
    const apiId = document.getElementById('testApiSelect').value;
    const scenariosDiv = document.getElementById('testScenarios');
    const authStatusDiv = document.getElementById('apiAuthStatus');
    const authStatusText = document.getElementById('authStatusText');
    const tempTokenContainer = document.getElementById('tempTokenContainer');
    const tempTokenInput = document.getElementById('tempTokenInput');

    if (apiId) {
        // Find the selected API
        const selectedAPI = currentAPIs.find(api => api.id === parseInt(apiId));

        // Show/hide auth status banner and temp token input
        if (selectedAPI && selectedAPI.auth_required) {
            const tokenStatus = selectedAPI.auth_token ? 'Token configured ✓' : 'No token provided (will use placeholder)';
            authStatusText.textContent = `Type: ${selectedAPI.auth_type || 'Bearer Token'} | ${tokenStatus}`;
            authStatusDiv.style.display = 'block';

            // Show temporary token input
            tempTokenContainer.style.display = 'block';

            // Load saved token from localStorage for this API
            const savedToken = getTempToken(apiId);
            if (savedToken) {
                tempTokenInput.value = savedToken;
            } else {
                tempTokenInput.value = '';
            }
        } else {
            authStatusDiv.style.display = 'none';
            tempTokenContainer.style.display = 'none';
        }

        scenariosDiv.style.display = 'block';
        currentScenarios = [];
        addScenario(); // Add initial scenario
    } else {
        scenariosDiv.style.display = 'none';
        authStatusDiv.style.display = 'none';
        tempTokenContainer.style.display = 'none';
    }
}

// Temporary Token Management (localStorage)
function getTempToken(apiId) {
    const key = `temp_token_api_${apiId}`;
    return localStorage.getItem(key);
}

function saveTempToken(apiId, token) {
    const key = `temp_token_api_${apiId}`;
    if (token && token.trim()) {
        localStorage.setItem(key, token.trim());
        console.log(`💾 Saved temp token for API ${apiId}`);
    } else {
        localStorage.removeItem(key);
    }
}

function clearTempToken() {
    const apiId = document.getElementById('testApiSelect').value;
    if (apiId) {
        const key = `temp_token_api_${apiId}`;
        localStorage.removeItem(key);
        document.getElementById('tempTokenInput').value = '';
        showToast('Temporary token cleared', 'success');
        console.log(`🗑️ Cleared temp token for API ${apiId}`);

        // Refresh scenarios to remove the token from headers
        if (currentScenarios.length > 0) {
            renderScenarios();
        }
    }
}

async function addScenario() {
    const apiId = document.getElementById('testApiSelect').value;
    const scenarioId = Date.now();

    // Find the selected API to get its registered parameters
    const selectedAPI = currentAPIs.find(api => api.id === parseInt(apiId));

    // Extract parameters based on structure (new format or old format)
    let bodyParams = {};
    let queryParams = {};
    let customHeaders = {};

    if (selectedAPI?.request_params) {
        if (selectedAPI.request_params.body || selectedAPI.request_params.query ||
            selectedAPI.request_params.path || selectedAPI.request_params.headers) {
            // New format
            bodyParams = selectedAPI.request_params.body || {};
            queryParams = selectedAPI.request_params.query || {};
            customHeaders = selectedAPI.request_params.headers || {};
        } else {
            // Old format - assume body params
            bodyParams = selectedAPI.request_params;
        }
    }

    // Use appropriate params based on method
    const defaultParams = ['GET', 'DELETE'].includes(selectedAPI?.method) ? queryParams : bodyParams;

    const newScenario = {
        id: scenarioId,
        name: `Scenario ${currentScenarios.length + 1}`,
        params: defaultParams,
        headers: { 'Content-Type': 'application/json', ...customHeaders }
    };

    console.log('➕ Adding scenario with registered params:', newScenario.params);

    // Try to fetch sample data for the new scenario
    if (apiId) {
        try {
            const sampleDataResponse = await fetch(`${API_BASE}/test/${apiId}/sample-data`);
            const sampleDataResult = await sampleDataResponse.json();

            if (sampleDataResult.success && sampleDataResult.sample_data) {
                const sampleData = sampleDataResult.sample_data;

                // Apply sample data to the new scenario (merge with registered params)
                if (sampleData.authorization && !newScenario.headers.Authorization) {
                    newScenario.headers.Authorization = sampleData.authorization;
                }
                if (sampleData.headers) {
                    newScenario.headers = { ...newScenario.headers, ...sampleData.headers };
                }
                if (sampleData.params) {
                    // Merge: keep registered params, add any additional sample params
                    newScenario.params = { ...sampleData.params, ...newScenario.params };
                }
            }
        } catch (error) {
            console.warn('Could not fetch sample data for new scenario:', error);
        }
    }

    currentScenarios.push(newScenario);
    renderScenarios();
}

function renderScenarios() {
    const container = document.getElementById('scenariosList');

    container.innerHTML = currentScenarios.map((scenario, index) => {
        const apiId = document.getElementById('testApiSelect').value;
        const selectedAPI = currentAPIs.find(api => api.id === parseInt(apiId));

        // Determine parameter location based on HTTP method
        const paramLocation = selectedAPI && ['GET', 'DELETE'].includes(selectedAPI.method) ? 'Query' : 'Body';

        // Apply temporary token if available and API requires auth
        const tempToken = getTempToken(apiId);
        if (tempToken && selectedAPI && selectedAPI.auth_required) {
            // Apply temp token to Authorization header (overrides any existing token)
            const authType = selectedAPI.auth_type || 'Bearer Token';
            if (authType === 'API Key') {
                scenario.headers['Authorization'] = tempToken;
                scenario.headers['X-API-Key'] = tempToken;
            } else if (authType === 'Basic Auth') {
                scenario.headers['Authorization'] = tempToken.startsWith('Basic ') ? tempToken : `Basic ${tempToken}`;
            } else {
                // Bearer Token or OAuth
                scenario.headers['Authorization'] = tempToken.startsWith('Bearer ') ? tempToken : `Bearer ${tempToken}`;
            }
            console.log(`🔑 Applied temp token to scenario ${index + 1}`);
        }

        // Build parameter inputs
        const paramInputs = Object.entries(scenario.params || {}).map(([key, value]) => `
            <div class="param-input-row">
                <div class="param-key">
                    <span class="param-type-badge">${paramLocation}</span>
                    <span class="param-name">${key}</span>
                </div>
                <input
                    type="text"
                    class="param-value"
                    value="${escapeHtml(String(value))}"
                    onchange="updateScenarioParamValue(${scenario.id}, '${escapeHtml(key)}', this.value)"
                    placeholder="Enter ${key}">
            </div>
        `).join('');

        // Build header inputs
        const headerInputs = Object.entries(scenario.headers || {}).map(([key, value]) => `
            <div class="param-input-row">
                <div class="param-key">
                    <span class="param-type-badge header-badge">Header</span>
                    <span class="param-name">${key}</span>
                </div>
                <input
                    type="text"
                    class="param-value"
                    value="${escapeHtml(String(value))}"
                    onchange="updateScenarioHeaderValue(${scenario.id}, '${escapeHtml(key)}', this.value)"
                    placeholder="Enter ${key}">
            </div>
        `).join('');

        return `
            <div class="scenario-item" data-id="${scenario.id}">
                <div class="scenario-header">
                    <strong>Scenario ${index + 1}</strong>
                    <div>
                        <button class="btn btn-secondary btn-sm" onclick="fillSampleData(${scenario.id})" title="Fill with AI sample data">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                            AI Fill
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="removeScenario(${scenario.id})" style="margin-left: 0.5rem;">Remove</button>
                    </div>
                </div>

                <div class="form-group">
                    <label>Scenario Name</label>
                    <input type="text" value="${scenario.name}" onchange="updateScenarioName(${scenario.id}, this.value)">
                    ${scenario.description ? `<small style="color: #666; margin-top: 0.25rem; display: block;">${scenario.description}</small>` : ''}
                </div>

                ${paramInputs ? `
                    <div class="form-group">
                        <label style="margin-bottom: 0.75rem; display: block;">${paramLocation} Parameters</label>
                        <div class="params-container">
                            ${paramInputs}
                        </div>
                    </div>
                ` : '<div class="form-group"><small style="color: #999;">No parameters defined</small></div>'}

                ${headerInputs ? `
                    <div class="form-group">
                        <label style="margin-bottom: 0.75rem; display: block;">Headers</label>
                        <div class="params-container">
                            ${headerInputs}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

async function fillSampleData(scenarioId) {
    const apiId = document.getElementById('testApiSelect').value;
    if (!apiId) {
        showToast('Please select an API first', 'error');
        return;
    }

    const scenario = currentScenarios.find(s => s.id === scenarioId);
    if (!scenario) return;

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/test/${apiId}/sample-data`);
        const result = await response.json();

        if (result.success && result.sample_data) {
            const sampleData = result.sample_data;

            // Apply sample data
            if (sampleData.authorization) {
                scenario.headers.Authorization = sampleData.authorization;
            }
            if (sampleData.headers) {
                scenario.headers = { ...scenario.headers, ...sampleData.headers };
            }
            if (sampleData.params) {
                scenario.params = { ...scenario.params, ...sampleData.params };
            }

            renderScenarios();
            showToast('Sample data filled successfully! ✨', 'success');

            if (sampleData.notes) {
                showToast(`💡 ${sampleData.notes}`, 'info');
            }
        } else {
            showToast('No sample data available', 'error');
        }
    } catch (error) {
        showToast('Error fetching sample data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function removeScenario(id) {
    currentScenarios = currentScenarios.filter(s => s.id !== id);
    renderScenarios();
}

function updateScenarioName(id, name) {
    const scenario = currentScenarios.find(s => s.id === id);
    if (scenario) scenario.name = name;
}

function updateScenarioParamValue(id, key, value) {
    const scenario = currentScenarios.find(s => s.id === id);
    if (!scenario) return;

    if (!scenario.params) scenario.params = {};

    // Try to parse as JSON for numbers, booleans, objects, arrays
    try {
        const parsed = JSON.parse(value);
        scenario.params[key] = parsed;
    } catch (e) {
        // If not valid JSON, treat as string
        scenario.params[key] = value;
    }

    console.log(`Updated param ${key} = ${value}`, scenario.params);
}

function updateScenarioHeaderValue(id, key, value) {
    const scenario = currentScenarios.find(s => s.id === id);
    if (!scenario) return;

    if (!scenario.headers) scenario.headers = {};
    scenario.headers[key] = value;

    console.log(`Updated header ${key} = ${value}`, scenario.headers);
}

async function autoGenerateScenarios() {
    const apiId = document.getElementById('testApiSelect').value;
    if (!apiId) {
        showToast('Please select an API first', 'error');
        return;
    }

    showLoading(true);

    try {
        // Fetch scenarios
        const scenariosResponse = await fetch(`${API_BASE}/test/${apiId}/scenarios`);
        const scenariosResult = await scenariosResponse.json();

        if (!scenariosResult.success) {
            showToast('Failed to generate scenarios', 'error');
            return;
        }

        // Fetch AI-generated sample data
        const sampleDataResponse = await fetch(`${API_BASE}/test/${apiId}/sample-data`);
        const sampleDataResult = await sampleDataResponse.json();

        let sampleData = null;
        if (sampleDataResult.success && sampleDataResult.sample_data) {
            sampleData = sampleDataResult.sample_data;
            console.log('🎨 AI-generated sample data:', sampleData);
        }

        // Merge scenarios with sample data
        currentScenarios = scenariosResult.scenarios.map((s, i) => {
            const scenario = {
                id: Date.now() + i,
                name: s.name,
                description: s.description,
                params: s.params || {},
                headers: s.headers || {}
            };

            // Apply AI-generated sample data
            if (sampleData) {
                // Add authorization if available and not already present
                if (sampleData.authorization && !scenario.headers.Authorization) {
                    scenario.headers.Authorization = sampleData.authorization;
                }

                // Merge additional headers from sample data
                if (sampleData.headers) {
                    Object.keys(sampleData.headers).forEach(key => {
                        if (!scenario.headers[key]) {
                            scenario.headers[key] = sampleData.headers[key];
                        }
                    });
                }

                // Merge sample params with existing params (prefer scenario params, add missing from sample)
                if (sampleData.params) {
                    scenario.params = { ...sampleData.params, ...scenario.params };
                }
            }

            return scenario;
        });

        renderScenarios();

        const message = sampleData
            ? 'Scenarios generated with AI-powered sample data! ✨'
            : 'Scenarios generated successfully';
        showToast(message, 'success');

        if (sampleData && sampleData.notes) {
            showToast(`💡 ${sampleData.notes}`, 'info');
        }
    } catch (error) {
        showToast('Error generating scenarios: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function runTests() {
    const apiId = document.getElementById('testApiSelect').value;
    if (!apiId) {
        showToast('Please select an API', 'error');
        return;
    }

    if (currentScenarios.length === 0) {
        showToast('Please add at least one scenario', 'error');
        return;
    }

    showLoading(true);

    try {
        const scenarios = currentScenarios.map(s => ({
            name: s.name,
            params: s.params,
            headers: s.headers
        }));

        const response = await fetch(`${API_BASE}/test/${apiId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenarios })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Tests completed!', 'success');
            displayTestResults(result);
        } else {
            showToast('Tests failed: ' + (result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error running tests: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayTestResults(result) {
    const card = document.getElementById('testResultsCard');
    const content = document.getElementById('testResultsContent');

    const summary = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Tests</div>
                <div class="stat-value">${result.total_scenarios || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Successful</div>
                <div class="stat-value" style="color: var(--success)">${result.successful_tests || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Failed</div>
                <div class="stat-value" style="color: var(--error)">${result.failed_tests || 0}</div>
            </div>
        </div>
        <h3 style="margin: 1.5rem 0 1rem;">Test Results</h3>
        ${result.test_results.map(test => `
            <div class="test-result-item ${test.success ? 'success' : 'error'}">
                <div class="result-header">
                    <div class="result-title">
                        ${test.scenario_name}
                        <span class="result-status status-${test.success ? 'success' : 'error'}">
                            ${test.status || 'N/A'}
                        </span>
                    </div>
                    <div>${test.response_time}ms</div>
                </div>
                ${test.error ? `<div class="result-details" style="color: var(--error);">Error: ${escapeHtml(test.error)}</div>` : ''}
                ${test.body ? `
                    <div class="result-code">
                        <strong>Response:</strong>
                        <pre>${JSON.stringify(typeof test.body === 'string' ? test.body.substring(0, 500) : test.body, null, 2)}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('')}
        ${result.ai_analysis && result.ai_analysis.summary ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: var(--background); border-radius: var(--radius);">
                <h3 style="margin-bottom: 0.75rem;">AI Analysis</h3>
                <p style="margin-bottom: 0.75rem;">${escapeHtml(result.ai_analysis.summary)}</p>
                ${result.ai_analysis.recommendations && result.ai_analysis.recommendations.length > 0 ? `
                    <strong>Recommendations:</strong>
                    <ul style="margin-top: 0.5rem;">
                        ${result.ai_analysis.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        ` : ''}
    `;

    content.innerHTML = summary;
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Results History
// ============================================

async function loadAPIsForResults() {
    const select = document.getElementById('resultsApiSelect');
    select.innerHTML = '<option value="">-- Select API --</option>';

    if (currentAPIs.length === 0) {
        await loadAPIs();
    }

    currentAPIs.forEach(api => {
        const option = document.createElement('option');
        option.value = api.id;
        option.textContent = `${api.name} (${api.method})`;
        select.appendChild(option);
    });
}

async function loadTestResults() {
    const apiId = document.getElementById('resultsApiSelect').value;
    const content = document.getElementById('resultsContent');
    const emptyState = document.getElementById('resultsEmpty');

    if (!apiId) {
        content.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/test/${apiId}/results?limit=20`);
        const result = await response.json();

        if (result.success && result.results.length > 0) {
            emptyState.style.display = 'none';
            content.innerHTML = result.results.map(test => `
                <div class="test-result-item ${test.success ? 'success' : 'error'}">
                    <div class="result-header">
                        <div class="result-title">
                            ${test.scenario_name}
                            <span class="result-status status-${test.success ? 'success' : 'error'}">
                                ${test.response_status || 'N/A'}
                            </span>
                        </div>
                        <div>
                            ${test.response_time_ms}ms
                            <small style="margin-left: 0.5rem; color: var(--text-secondary);">${formatDate(test.tested_at)}</small>
                        </div>
                    </div>
                    ${test.error_message ? `<div class="result-details" style="color: var(--error);">Error: ${escapeHtml(test.error_message)}</div>` : ''}
                </div>
            `).join('');
        } else {
            content.innerHTML = '';
            emptyState.style.display = 'block';
        }
    } catch (error) {
        showToast('Error loading test results: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// Statistics
// ============================================

async function loadStatistics() {
    const content = document.getElementById('statisticsContent');
    const emptyState = document.getElementById('statisticsEmpty');

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/stats`);
        const result = await response.json();

        if (result.success && result.statistics.length > 0) {
            emptyState.style.display = 'none';
            content.innerHTML = result.statistics.map(stat => `
                <div class="api-card" style="margin-bottom: 1rem;">
                    <div class="api-card-header">
                        <div class="api-card-title">${escapeHtml(stat.name)}</div>
                        <span class="api-badge badge-${stat.method}">${stat.method}</span>
                    </div>
                    <div class="stats-grid" style="margin-top: 1rem;">
                        <div class="stat-card">
                            <div class="stat-label">Total Tests</div>
                            <div class="stat-value">${stat.total_tests || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Successful</div>
                            <div class="stat-value" style="color: var(--success)">${stat.successful_tests || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Failed</div>
                            <div class="stat-value" style="color: var(--error)">${stat.failed_tests || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Avg Response</div>
                            <div class="stat-value">${stat.avg_response_time_ms ? Math.round(stat.avg_response_time_ms) : 0}ms</div>
                        </div>
                    </div>
                    ${stat.last_tested_at ? `<div style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">Last tested: ${formatDate(stat.last_tested_at)}</div>` : ''}
                </div>
            `).join('');
        } else {
            content.innerHTML = '';
            emptyState.style.display = 'block';
        }
    } catch (error) {
        showToast('Error loading statistics: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// UI Utilities
// ============================================

function showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Query/Chat Interface
// ============================================

let chatMessages = [];
let conversationContext = {
    currentAPI: null,        // Currently discussed API
    lastAction: null,        // Last action performed
    recentAPIs: [],          // Recently mentioned APIs
    allAPIs: []              // Cached list of all APIs
};

function initializeQueryTab() {
    const sendBtn = document.getElementById('sendQueryBtn');
    const queryInput = document.getElementById('queryInput');
    const suggestionBtns = document.querySelectorAll('.suggestion-btn');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendQuery);
    }

    if (queryInput) {
        queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuery();
            }
        });
    }

    suggestionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            queryInput.value = btn.dataset.query;
            sendQuery();
        });
    });

    renderChatMessages();
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const query = input.value.trim();

    if (!query) {
        showToast('Please enter a question', 'error');
        return;
    }

    // Add user message
    addChatMessage('user', query);
    input.value = '';

    // Show typing indicator
    showTyping();

    try {
        // Fetch all APIs if not cached
        if (conversationContext.allAPIs.length === 0) {
            try {
                const apisResponse = await fetch(`${API_BASE}/apis`);
                const apisData = await apisResponse.json();
                if (apisData.success && apisData.apis) {
                    conversationContext.allAPIs = apisData.apis;
                }
            } catch (e) {
                console.warn('Could not fetch APIs for context:', e);
            }
        }

        // Process query with AI and context
        const response = await processQuery(query);

        // Remove typing indicator
        hideTyping();

        // Add assistant response
        addChatMessage('assistant', response);
    } catch (error) {
        hideTyping();
        addChatMessage('system', `Error: ${error.message}`);
        showToast('Error processing query: ' + error.message, 'error');
    }
}

async function processQuery(query) {
    const queryLower = query.toLowerCase();

    // Check for explicit API ID first
    const explicitApiMatch = query.match(/api\s+(\d+)/i);
    if (explicitApiMatch) {
        const apiId = parseInt(explicitApiMatch[1]);
        conversationContext.currentAPI = apiId;
        conversationContext.recentAPIs.unshift(apiId);
        conversationContext.recentAPIs = [...new Set(conversationContext.recentAPIs)].slice(0, 5);
    }

    // Intent: List all APIs
    if (queryLower.includes('list') || queryLower.includes('show all') || queryLower.includes('what apis')) {
        const apis = await fetch(`${API_BASE}/apis`).then(r => r.json());
        conversationContext.lastAction = 'list';
        if (apis.success && apis.apis.length > 0) {
            conversationContext.recentAPIs = apis.apis.slice(0, 5).map(a => a.id);
        }
        return formatAPIList(apis);
    }

    // Use AI to resolve context and intent
    return await processWithAI(query);
}

async function processWithAI(query) {
    // Build conversation history for context
    const conversationHistory = chatMessages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // Send context-aware query to backend
    const response = await fetch(`${API_BASE}/ai-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query,
            context: {
                currentAPI: conversationContext.currentAPI,
                lastAction: conversationContext.lastAction,
                recentAPIs: conversationContext.recentAPIs,
                conversationHistory
            },
            allAPIs: conversationContext.allAPIs.map(api => ({
                id: api.id,
                name: api.name,
                endpoint: api.endpoint,
                method: api.method
            }))
        })
    });

    if (!response.ok) {
        throw new Error('AI query processing failed');
    }

    const result = await response.json();

    // Update context based on AI response
    if (result.context) {
        if (result.context.currentAPI) {
            conversationContext.currentAPI = result.context.currentAPI;
        }
        if (result.context.action) {
            conversationContext.lastAction = result.context.action;
        }
        if (result.context.apiId) {
            conversationContext.currentAPI = result.context.apiId;
            conversationContext.recentAPIs.unshift(result.context.apiId);
            conversationContext.recentAPIs = [...new Set(conversationContext.recentAPIs)].slice(0, 5);
        }
    }

    // If AI performed an action, format accordingly
    if (result.action === 'query_with_summary') {
        return formatQueryWithSummary(result.data);
    } else if (result.action === 'validate') {
        return formatValidationResult(result.data);
    } else if (result.action === 'get_api') {
        return formatAPIDetails(result.data);
    } else if (result.action === 'metadata') {
        return formatAPIMetadata(result.data);
    }

    return result.response || 'I processed your query but got no response.';
}

function formatAPIList(data) {
    if (!data.success || !data.apis || data.apis.length === 0) {
        return 'No APIs found.';
    }

    let response = `Found ${data.apis.length} registered API(s):\n\n`;
    data.apis.forEach((api, i) => {
        response += `${i + 1}. **${api.name}** (ID: ${api.id})\n`;
        response += `   - Method: ${api.method}\n`;
        response += `   - Endpoint: ${api.endpoint}\n`;
        response += `   - Status: ${api.status}\n\n`;
    });
    return response;
}

function formatQueryWithSummary(data) {
    if (!data.success) {
        return `Error: ${data.message || 'Query failed'}`;
    }

    let response = `**API Query Result**\n\n`;
    response += `API: ${data.api_name}\n`;
    response += `Endpoint: ${data.endpoint}\n`;
    response += `Method: ${data.method}\n\n`;
    response += `**Response:**\n`;
    response += `Status: ${data.response.status}\n`;
    response += `Response Time: ${data.response.response_time}ms\n\n`;
    response += `**AI Summary:**\n${data.ai_summary}\n\n`;
    response += `**Response Data:**\n\`\`\`json\n${JSON.stringify(data.response.body, null, 2)}\n\`\`\``;
    return response;
}

function formatValidationResult(data) {
    if (!data.success) {
        return `Validation Error: ${data.error || 'Unknown error'}`;
    }

    let response = `**API Validation & Execution Result**\n\n`;
    response += `**Validation:**\n`;
    response += `Method: ${data.validation.method}\n`;

    if (data.validation.warnings && data.validation.warnings.length > 0) {
        response += `\n⚠️ **Warnings:**\n`;
        data.validation.warnings.forEach(w => {
            response += `- ${w.message}\n`;
            if (w.missing) {
                response += `  Missing: ${w.missing.join(', ')}\n`;
            }
        });
    } else {
        response += `✅ No validation warnings\n`;
    }

    response += `\n**Execution:**\n`;
    response += `Status: ${data.execution.status}\n`;
    response += `Response Time: ${data.execution.response_time}ms\n`;
    response += `Success: ${data.execution.success ? 'Yes' : 'No'}\n\n`;
    response += `**Response Data:**\n\`\`\`json\n${JSON.stringify(data.execution.body, null, 2)}\n\`\`\``;
    return response;
}

function formatAPIMetadata(data) {
    if (!data.success || !data.metadata || data.metadata.length === 0) {
        return 'No metadata found for this API.';
    }

    const latest = data.metadata[0];
    let response = `**API Metadata (Latest)**\n\n`;
    response += `**Summary:** ${latest.ai_summary}\n\n`;

    if (latest.ai_recommendations) {
        const rec = latest.ai_recommendations;
        response += `**Requirements:**\n`;
        response += `- Authorization Required: ${rec.authorization_required ? 'Yes' : 'No'}\n`;
        if (rec.authorization_required) {
            response += `- Auth Type: ${rec.auth_type}\n`;
            response += `- Required Headers: ${rec.required_headers?.join(', ') || 'None'}\n`;
        }
    }

    response += `\n**Risk Assessment:** ${latest.risk_assessment}\n`;
    response += `**Performance Notes:** ${latest.performance_notes}\n`;
    response += `**Model Used:** ${latest.model_used}\n`;
    return response;
}

function formatAllMetadata(data) {
    if (!data.success || !data.metadata || data.metadata.length === 0) {
        return 'No metadata available.';
    }

    let response = `**All API Metadata (${data.total} total)**\n\n`;
    data.metadata.forEach((item, i) => {
        response += `${i + 1}. **API ID ${item.api_id}**\n`;
        if (item.ai_summary) {
            response += `   Summary: ${item.ai_summary.substring(0, 100)}...\n`;
        }
        response += `\n`;
    });
    return response;
}

function formatAPIDetails(data) {
    if (!data.api) {
        return 'API not found.';
    }

    const api = data.api;
    let response = `**API Details**\n\n`;
    response += `Name: ${api.name}\n`;
    response += `ID: ${api.id}\n`;
    response += `Endpoint: ${api.endpoint}\n`;
    response += `Method: ${api.method}\n`;
    response += `Status: ${api.status}\n`;
    response += `Content Type: ${api.request_type}\n`;
    response += `Description: ${api.description || 'No description'}\n`;
    response += `Created: ${new Date(api.created_at).toLocaleString()}\n`;
    return response;
}

function addChatMessage(role, content) {
    chatMessages.push({ role, content, timestamp: new Date() });
    renderChatMessages();

    // Scroll to bottom
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (chatMessages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <p>Start a conversation by asking a question above</p>
            </div>
        `;
        return;
    }

    container.innerHTML = chatMessages.map(msg => {
        const roleLabel = msg.role === 'user' ? 'You' : (msg.role === 'assistant' ? 'AI Assistant' : 'System');
        const formattedContent = msg.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        return `
            <div class="chat-message ${msg.role}">
                <div class="chat-message-header">${roleLabel}</div>
                <div class="chat-message-content">${formattedContent}</div>
            </div>
        `;
    }).join('');
}

function showTyping() {
    const container = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'chat-typing';
    typingDiv.innerHTML = `
        <span>AI is thinking</span>
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}
