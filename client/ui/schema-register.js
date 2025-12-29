/**
 * Schema Registration Client-Side Logic
 */

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the base URL for the current host (works in development and production)
 * @returns {string} Base URL (e.g., http://localhost:3000 or https://your-app.com)
 */
function getBaseUrl() {
    // Use window.location to get current protocol and host
    return window.location.protocol + '//' + window.location.host;
}

// Global variables
let previewedSchema = null;

// Initialize schema registration functionality
async function initSchemaRegistration() {
    // Load current schema info
    await loadCurrentSchema();

    // Load history
    await loadSchemaHistory();

    // Setup event listeners
    setupSchemaEventListeners();
}

// Setup event listeners
function setupSchemaEventListeners() {
    // Schema input method radio buttons
    document.querySelectorAll('input[name="schemaInputMethod"]').forEach(radio => {
        radio.addEventListener('change', handleInputMethodChange);
    });

    // File input change
    document.getElementById('schemaFile').addEventListener('change', handleFileSelect);

    // Preview button
    document.getElementById('previewSchemaBtn').addEventListener('click', handlePreviewSchema);

    // Register schema form submit
    document.getElementById('registerSchemaForm').addEventListener('submit', handleRegisterSchema);

    // Reset button
    document.getElementById('resetSchemaBtn').addEventListener('click', handleResetSchema);
}

// Handle input method change
function handleInputMethodChange(e) {
    const method = e.target.value;

    // Hide all sections
    document.getElementById('fileUploadSection').style.display = 'none';
    document.getElementById('urlInputSection').style.display = 'none';
    document.getElementById('githubUrlSection').style.display = 'none';

    // Show selected section
    if (method === 'file') {
        document.getElementById('fileUploadSection').style.display = 'block';
    } else if (method === 'url') {
        document.getElementById('urlInputSection').style.display = 'block';
    } else if (method === 'github') {
        document.getElementById('githubUrlSection').style.display = 'block';
    }

    // Reset preview
    document.getElementById('schemaPreview').style.display = 'none';
    document.getElementById('registerSchemaBtn').disabled = true;
    previewedSchema = null;
}

// Handle file selection
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const schema = JSON.parse(event.target.result);
                showToast('File loaded successfully. Click "Preview Schema" to review.', 'success');
            } catch (error) {
                showToast('Invalid JSON file: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    } else {
        showToast('Please select a valid JSON file', 'error');
    }
}

// Handle preview schema
async function handlePreviewSchema() {
    const method = document.querySelector('input[name="schemaInputMethod"]:checked').value;

    try {
        showLoading(true);
        let schema = null;
        let source = '';

        if (method === 'file') {
            const fileInput = document.getElementById('schemaFile');
            if (!fileInput.files[0]) {
                showToast('Please select a file first', 'error');
                return;
            }

            schema = await readFileAsJSON(fileInput.files[0]);
            source = fileInput.files[0].name;

        } else if (method === 'url' || method === 'github') {
            const urlInput = method === 'url'
                ? document.getElementById('schemaUrl')
                : document.getElementById('schemaGithubUrl');

            if (!urlInput.value.trim()) {
                showToast('Please enter a URL', 'error');
                return;
            }

            // Fetch from URL
            const response = await fetch('/api/schema/fetch-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput.value.trim() })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }

            schema = data.schema;
            source = data.source;
        }

        // Validate schema
        if (!schema.name || !schema.version) {
            throw new Error('Invalid schema: missing name or version');
        }

        // Store for registration
        previewedSchema = { schema, source, sourceType: method };

        // Display preview
        displaySchemaPreview(schema, source);

        // Enable register button
        document.getElementById('registerSchemaBtn').disabled = false;

        showToast('Schema preview loaded successfully', 'success');

    } catch (error) {
        showToast('Preview failed: ' + error.message, 'error');
        document.getElementById('schemaPreview').style.display = 'none';
        document.getElementById('registerSchemaBtn').disabled = true;
    } finally {
        showLoading(false);
    }
}

// Display schema preview
function displaySchemaPreview(schema, source) {
    const previewDiv = document.getElementById('schemaPreview');
    const contentPre = document.getElementById('schemaPreviewContent');

    // Show truncated JSON
    const truncatedSchema = {
        name: schema.name,
        version: schema.version,
        tools: schema.tools ? `${schema.tools.length} tools` : 'No tools',
        resources: schema.resources ? `${schema.resources.length} resources` : 'No resources',
        schemas: schema.schemas ? `${Object.keys(schema.schemas).length} schemas` : 'No schemas'
    };

    contentPre.textContent = JSON.stringify(truncatedSchema, null, 2);

    // Update detection info
    document.getElementById('previewSchemaName').textContent = schema.name || 'Unknown';
    document.getElementById('previewSchemaVersion').textContent = schema.version || 'Unknown';
    document.getElementById('previewToolsCount').textContent = schema.tools?.length || 0;
    document.getElementById('previewResourcesCount').textContent = schema.resources?.length || 0;

    previewDiv.style.display = 'block';
}

// Handle register schema
async function handleRegisterSchema(e) {
    e.preventDefault();

    if (!previewedSchema) {
        showToast('Please preview the schema first', 'error');
        return;
    }

    try {
        showLoading(true);

        const response = await fetch('/api/schema/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(previewedSchema)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        showToast('Schema registered and loaded successfully! MCP server reloaded.', 'success');

        // Reload current schema info
        await loadCurrentSchema();
        await loadSchemaHistory();

        // Auto-connect to MCP and display tools if tools are returned
        if (data.tools && data.mcpServerUrl) {
            connectedMcpServer = {
                url: data.mcpServerUrl,
                toolsCount: data.tools.length,
                tools: data.tools
            };
            mcpTools = data.tools;

            // Update MCP connector UI
            document.getElementById('mcpServerUrl').value = data.mcpServerUrl;
            updateMcpConnectionUI(true);
            displayMcpTools(data.tools);
            addMcpLog('Auto-connected after schema registration (' + data.tools.length + ' tools)');

            // Update Test Individual Tools dropdown with new schema's tools
            populateToolSelect();
        }

        // Reset form
        document.getElementById('registerSchemaForm').reset();
        document.getElementById('schemaPreview').style.display = 'none';
        document.getElementById('registerSchemaBtn').disabled = true;
        previewedSchema = null;

    } catch (error) {
        showToast('Registration failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle reset schema
async function handleResetSchema() {
    if (!confirm('Are you sure you want to reset to the default schema?')) {
        return;
    }

    try {
        showLoading(true);

        const response = await fetch('/api/schema/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        showToast('Schema reset to default successfully', 'success');

        // Clear connected MCP server to force fallback to default schema-driven MCP
        connectedMcpServer = null;
        mcpTools = [];
        updateMcpConnectionUI(false);

        // Reload current schema info
        await loadCurrentSchema();

        // Update Test Individual Tools dropdown with default schema tools
        populateToolSelect();

    } catch (error) {
        showToast('Reset failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Load current schema info
async function loadCurrentSchema() {
    try {
        const response = await fetch('/api/schema/current');
        const data = await response.json();

        if (data.success) {
            const schema = data.schema;
            document.getElementById('schemaName').textContent = schema.name;
            document.getElementById('schemaVersion').textContent = schema.version;
            document.getElementById('schemaToolsCount').textContent = schema.toolsCount;
            document.getElementById('schemaSource').textContent = schema.source;

            // Highlight if custom
            const infoDiv = document.getElementById('currentSchemaInfo');
            if (schema.isCustom) {
                infoDiv.className = 'alert alert-success';
            } else {
                infoDiv.className = 'alert alert-info';
            }

            // Trigger schema update event to refresh tool select
            window.dispatchEvent(new Event('schemaUpdated'));
        }
    } catch (error) {
        console.error('Failed to load current schema:', error);
    }
}

// Load schema history
async function loadSchemaHistory() {
    try {
        const response = await fetch('/api/schema/history');
        const data = await response.json();

        if (data.success) {
            const historyDiv = document.getElementById('schemaHistory');

            if (data.history.length === 0) {
                historyDiv.innerHTML = '<p style="color: #666; font-style: italic;">No registration history yet</p>';
            } else {
                historyDiv.innerHTML = data.history.map(entry => `
                    <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f8f9fa; border-left: 3px solid #0066cc; border-radius: 4px;">
                        <div style="font-weight: 600;">${entry.name} v${entry.version}</div>
                        <div style="font-size: 0.875rem; color: #666; margin-top: 0.25rem;">
                            Source: ${entry.source}<br>
                            Tools: ${entry.toolsCount} | ${new Date(entry.registeredAt).toLocaleString()}
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Failed to load schema history:', error);
    }
}

// Helper: Read file as JSON
function readFileAsJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                resolve(json);
            } catch (error) {
                reject(new Error('Invalid JSON: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Helper: Show loading overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// Helper: Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
}

// Helper: Show restart warning
function showRestartWarning(message) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    if (!modal) {
        alert(message + '\n\nPlease restart the server for changes to take effect.');
        return;
    }

    modalTitle.textContent = 'Server Restart Required';
    modalBody.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" style="display: block; margin: 0 auto 1rem;">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p style="text-align: center; font-size: 1.1rem; margin-bottom: 1rem;">${message}</p>
            <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <strong>To apply schema changes:</strong>
                <ol style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
                    <li>Restart the Node.js server</li>
                    <li>Refresh this page</li>
                    <li>Schema-driven MCP will use the new schema</li>
                </ol>
            </div>
            <p style="text-align: center; color: #666; font-size: 0.875rem;">
                The custom schema is saved and will be loaded on restart.
            </p>
        </div>
        <div style="text-align: center;">
            <button class="btn btn-primary" onclick="document.getElementById('modal').style.display='none'">
                Got it
            </button>
        </div>
    `;

    modal.style.display = 'flex';

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSchemaRegistration);
} else {
    initSchemaRegistration();
}

// ============================================
// MCP CONNECTOR FUNCTIONALITY
// ============================================

let connectedMcpServer = null;
let mcpTools = [];

// Initialize MCP connector
function initMcpConnector() {
    // Set default URL and placeholder dynamically
    const baseUrl = getBaseUrl();
    const defaultUrl = baseUrl + '/schema/mcp/sse';
    const mcpServerUrlInput = document.getElementById('mcpServerUrl');
    mcpServerUrlInput.value = defaultUrl;
    mcpServerUrlInput.placeholder = defaultUrl;

    // Setup event listeners
    document.getElementById('mcpConnectorForm').addEventListener('submit', handleMcpConnect);
    document.getElementById('mcpDisconnectBtn').addEventListener('click', handleMcpDisconnect);
    document.getElementById('mcpRefreshToolsBtn').addEventListener('click', handleMcpRefreshTools);
    document.getElementById('mcpToolsSearch').addEventListener('input', handleMcpToolsSearch);
}

// Set MCP URL from quick connect button
window.setMcpUrl = function(url) {
    // If URL is relative (starts with /), prepend the base URL
    const fullUrl = url.startsWith('/') ? getBaseUrl() + url : url;
    document.getElementById('mcpServerUrl').value = fullUrl;
};

// Handle MCP connection
async function handleMcpConnect(e) {
    e.preventDefault();

    const url = document.getElementById('mcpServerUrl').value.trim();

    if (!url) {
        showToast('Please enter an MCP server URL', 'error');
        return;
    }

    try {
        showLoading(true);
        addMcpLog('Connecting to ' + url + '...');

        const response = await fetch('/api/mcp/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        // Store connection
        connectedMcpServer = {
            url: url,
            toolsCount: data.toolsCount,
            tools: data.tools
        };
        mcpTools = data.tools;

        // Update UI
        updateMcpConnectionUI(true);
        displayMcpTools(data.tools);

        // Trigger tool population for Test Individual Tools section
        populateToolSelect();

        addMcpLog('Connected successfully (' + data.toolsCount + ' tools found)');
        showToast('Connected to MCP server! Found ' + data.toolsCount + ' tools', 'success');

    } catch (error) {
        addMcpLog('Connection failed: ' + error.message);
        showToast('Connection failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle MCP disconnect
function handleMcpDisconnect() {
    connectedMcpServer = null;
    mcpTools = [];

    updateMcpConnectionUI(false);
    addMcpLog('Disconnected from MCP server');
    showToast('Disconnected from MCP server', 'info');
}

// Handle refresh tools
async function handleMcpRefreshTools() {
    if (!connectedMcpServer) {
        showToast('No active connection', 'error');
        return;
    }

    try {
        showLoading(true);
        addMcpLog('Refreshing tools list...');

        const response = await fetch('/api/mcp/get-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: connectedMcpServer.url })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        mcpTools = data.tools;
        connectedMcpServer.tools = data.tools;
        connectedMcpServer.toolsCount = data.tools.length;

        displayMcpTools(data.tools);
        document.getElementById('connectedToolsCount').textContent = data.tools.length;

        addMcpLog('Tools refreshed (' + data.tools.length + ' tools)');
        showToast('Tools refreshed: ' + data.tools.length + ' tools found', 'success');

    } catch (error) {
        addMcpLog('Refresh failed: ' + error.message);
        showToast('Refresh failed: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle tools search
function handleMcpToolsSearch(e) {
    const searchTerm = e.target.value.toLowerCase();

    if (!mcpTools || mcpTools.length === 0) return;

    const filteredTools = mcpTools.filter(tool =>
        tool.name.toLowerCase().includes(searchTerm) ||
        (tool.description && tool.description.toLowerCase().includes(searchTerm))
    );

    displayMcpTools(filteredTools);
}

// Update MCP connection UI
function updateMcpConnectionUI(connected) {
    const statusDiv = document.getElementById('mcpConnectionStatus');
    const connectBtn = document.getElementById('mcpConnectBtn');
    const disconnectBtn = document.getElementById('mcpDisconnectBtn');
    const refreshBtn = document.getElementById('mcpRefreshToolsBtn');
    const toolsSection = document.getElementById('mcpToolsSection');
    const logSection = document.getElementById('mcpConnectionLog');

    if (connected && connectedMcpServer) {
        // Show connection status
        statusDiv.style.display = 'block';
        statusDiv.className = 'alert alert-success';
        document.getElementById('connectedMcpUrl').textContent = connectedMcpServer.url;
        document.getElementById('connectedToolsCount').textContent = connectedMcpServer.toolsCount;

        // Update buttons
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';
        refreshBtn.style.display = 'inline-flex';

        // Show tools section
        toolsSection.style.display = 'block';
        logSection.style.display = 'block';

    } else {
        // Hide connection status
        statusDiv.style.display = 'none';

        // Update buttons
        connectBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        refreshBtn.style.display = 'none';

        // Hide tools section
        toolsSection.style.display = 'none';

        // Clear tools list
        document.getElementById('mcpToolsList').innerHTML = '';
    }
}

// Display MCP tools
function displayMcpTools(tools) {
    const toolsList = document.getElementById('mcpToolsList');
    const toolsEmpty = document.getElementById('mcpToolsEmpty');
    const toolsCount = document.getElementById('mcpToolsCount');

    toolsCount.textContent = tools.length + ' tool' + (tools.length !== 1 ? 's' : '');

    if (tools.length === 0) {
        toolsList.style.display = 'none';
        toolsEmpty.style.display = 'block';
        return;
    }

    toolsList.style.display = 'grid';
    toolsEmpty.style.display = 'none';

    toolsList.innerHTML = tools.map(tool => {
        const schemaHtml = tool.inputSchema ?
            '<details style="font-size: 0.875rem;"><summary style="cursor: pointer; color: #0066cc; font-weight: 500;">View Input Schema</summary><pre style="margin-top: 0.5rem; background: #f8f9fa; padding: 0.5rem; border-radius: 4px; overflow-x: auto; font-size: 0.75rem;">' + JSON.stringify(tool.inputSchema, null, 2) + '</pre></details>'
            : '';

        return '<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;"><div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 0.5rem;"><div style="font-weight: 600; color: #1a202c;">' + tool.name + '</div><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066cc" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div><div style="font-size: 0.875rem; color: #666; margin-bottom: 0.75rem;">' + (tool.description || 'No description') + '</div>' + schemaHtml + '</div>';
    }).join('');
}

// Add log entry
function addMcpLog(message) {
    const logContent = document.getElementById('mcpLogContent');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.marginBottom = '0.25rem';
    logEntry.innerHTML = '<span style="color: #666;">[' + timestamp + ']</span> ' + message;
    logContent.appendChild(logEntry);

    // Auto-scroll to bottom
    logContent.parentElement.scrollTop = logContent.parentElement.scrollHeight;
}

// =============================================================================
// TEST INDIVIDUAL TOOLS (SANDBOX MODE)
// =============================================================================

let testToolHistory = [];
let currentToolDefinitions = [];

// Initialize test tool functionality
function initTestTools() {
    const testToolSelect = document.getElementById('testToolSelect');
    const testToolPayload = document.getElementById('testToolPayload');
    const testToolBtn = document.getElementById('testToolBtn');
    const clearTestPayloadBtn = document.getElementById('clearTestPayloadBtn');
    const generateSamplePayloadBtn = document.getElementById('generateSamplePayloadBtn');

    // Populate tools when current schema changes
    window.addEventListener('schemaUpdated', populateToolSelect);

    // Tool selection change
    testToolSelect.addEventListener('change', onToolSelectChange);

    // Test tool button
    testToolBtn.addEventListener('click', testTool);

    // Clear payload button
    clearTestPayloadBtn.addEventListener('click', () => {
        testToolPayload.value = '';
    });

    // Generate sample payload button
    generateSamplePayloadBtn.addEventListener('click', generateSamplePayload);
}

// Populate tool select dropdown
async function populateToolSelect() {
    const testToolSelect = document.getElementById('testToolSelect');
    const testToolPayload = document.getElementById('testToolPayload');
    const testToolBtn = document.getElementById('testToolBtn');
    const clearTestPayloadBtn = document.getElementById('clearTestPayloadBtn');
    const generateSamplePayloadBtn = document.getElementById('generateSamplePayloadBtn');

    try {
        // Check if user has connected to an MCP server via MCP Connector
        let toolsToUse = [];
        let serverUrl = '';
        let serverSource = '';

        if (connectedMcpServer && connectedMcpServer.tools && connectedMcpServer.tools.length > 0) {
            // Use tools from the connected MCP server
            console.log('Using tools from connected MCP server:', connectedMcpServer.url);
            toolsToUse = connectedMcpServer.tools;
            serverUrl = connectedMcpServer.url;
            serverSource = 'Connected via MCP Connector';
        } else {
            // Fallback to schema-driven MCP server
            console.log('Using tools from schema-driven MCP server');
            const baseUrl = getBaseUrl();
            const toolsResponse = await fetch(baseUrl + '/schema/mcp/tools');
            const toolsData = await toolsResponse.json();
            toolsToUse = toolsData.tools || [];
            serverUrl = baseUrl + '/schema/mcp/sse';
            serverSource = 'Default Schema-Driven MCP Server';
        }

        // Update server info display
        const testToolServerInfo = document.getElementById('testToolServerInfo');
        const testToolServerUrl = document.getElementById('testToolServerUrl');
        const testToolServerSource = document.getElementById('testToolServerSource');

        if (toolsToUse.length > 0) {
            testToolServerUrl.textContent = serverUrl;
            testToolServerSource.textContent = serverSource + ' (' + toolsToUse.length + ' tools)';
            testToolServerInfo.style.display = 'block';
        } else {
            testToolServerInfo.style.display = 'none';
        }

        currentToolDefinitions = toolsToUse;

        // Clear and populate dropdown
        testToolSelect.innerHTML = '';

        if (currentToolDefinitions.length === 0) {
            testToolSelect.innerHTML = '<option value="">No tools available</option>';
            testToolSelect.disabled = true;
            testToolPayload.disabled = true;
            testToolBtn.disabled = true;
            clearTestPayloadBtn.disabled = true;
            generateSamplePayloadBtn.disabled = true;
            return;
        }

        // Add tools to dropdown
        testToolSelect.innerHTML = '<option value="">Select a tool...</option>';
        currentToolDefinitions.forEach(tool => {
            const option = document.createElement('option');
            option.value = tool.name;
            option.textContent = tool.name + ' - ' + tool.description;
            option.dataset.tool = JSON.stringify(tool);
            testToolSelect.appendChild(option);
        });

        // Enable controls
        testToolSelect.disabled = false;
        testToolPayload.disabled = false;
        clearTestPayloadBtn.disabled = false;
        generateSamplePayloadBtn.disabled = false;

    } catch (error) {
        console.error('Error populating tools:', error);
        showToast('Failed to load tools: ' + error.message, 'error');
    }
}

// Handle tool selection change
function onToolSelectChange() {
    const testToolSelect = document.getElementById('testToolSelect');
    const testToolDescription = document.getElementById('testToolDescription');
    const testToolName = document.getElementById('testToolName');
    const testToolDesc = document.getElementById('testToolDesc');
    const testToolRequired = document.getElementById('testToolRequired');
    const testToolBtn = document.getElementById('testToolBtn');

    const selectedOption = testToolSelect.options[testToolSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        testToolDescription.style.display = 'none';
        testToolBtn.disabled = true;
        return;
    }

    try {
        const tool = JSON.parse(selectedOption.dataset.tool);

        // Show tool description
        testToolName.textContent = tool.name;
        testToolDesc.textContent = tool.description || 'No description available';

        // Show required fields
        const required = tool.inputSchema?.required || [];
        testToolRequired.textContent = required.length > 0 ? required.join(', ') : 'None';

        testToolDescription.style.display = 'block';
        testToolBtn.disabled = false;

    } catch (error) {
        console.error('Error parsing tool data:', error);
        testToolDescription.style.display = 'none';
        testToolBtn.disabled = true;
    }
}

// Generate sample payload based on tool input schema
function generateSamplePayload() {
    const testToolSelect = document.getElementById('testToolSelect');
    const testToolPayload = document.getElementById('testToolPayload');
    const selectedOption = testToolSelect.options[testToolSelect.selectedIndex];

    if (!selectedOption || !selectedOption.value) {
        showToast('Please select a tool first', 'warning');
        return;
    }

    try {
        const tool = JSON.parse(selectedOption.dataset.tool);
        const schema = tool.inputSchema;

        if (!schema || !schema.properties) {
            showToast('No schema available for this tool', 'warning');
            return;
        }

        // Generate sample payload from schema
        const sample = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            if (key === 'id') continue; // Skip ID field for create operations

            if (prop.type === 'string') {
                if (prop.enum) {
                    sample[key] = prop.enum[0];
                } else if (prop.format === 'date') {
                    sample[key] = new Date().toISOString().split('T')[0];
                } else {
                    sample[key] = 'Sample ' + key;
                }
            } else if (prop.type === 'number' || prop.type === 'integer') {
                sample[key] = 100;
            } else if (prop.type === 'boolean') {
                sample[key] = true;
            } else if (prop.type === 'array') {
                sample[key] = [];
            } else if (prop.type === 'object') {
                sample[key] = {};
            }
        }

        testToolPayload.value = JSON.stringify(sample, null, 2);
        showToast('Sample payload generated', 'success');

    } catch (error) {
        console.error('Error generating sample:', error);
        showToast('Failed to generate sample: ' + error.message, 'error');
    }
}

// Test tool with payload
async function testTool() {
    const testToolSelect = document.getElementById('testToolSelect');
    const testToolPayload = document.getElementById('testToolPayload');
    const testToolResults = document.getElementById('testToolResults');
    const testToolResultsContent = document.getElementById('testToolResultsContent');
    const testToolBtn = document.getElementById('testToolBtn');

    const toolName = testToolSelect.value;
    if (!toolName) {
        showToast('Please select a tool', 'warning');
        return;
    }

    let payload = {};
    try {
        if (testToolPayload.value.trim()) {
            payload = JSON.parse(testToolPayload.value);
        }
    } catch (error) {
        showToast('Invalid JSON payload: ' + error.message, 'error');
        return;
    }

    // Disable button during execution
    testToolBtn.disabled = true;
    testToolBtn.textContent = 'Executing...';

    try {
        const response = await fetch('/api/schema/test-tool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName, payload })
        });

        const result = await response.json();

        // Display results
        displayTestResult(result);

        // Add to history
        addTestHistory({
            toolName,
            payload,
            result,
            timestamp: new Date().toISOString()
        });

        // Show results section
        testToolResults.style.display = 'block';

        if (result.success) {
            showToast('Tool executed successfully in sandbox', 'success');
        } else {
            showToast('Tool execution failed', 'error');
        }

    } catch (error) {
        showToast('Failed to execute tool: ' + error.message, 'error');
        testToolResultsContent.innerHTML = '<div class="alert alert-error">Error: ' + error.message + '</div>';
        testToolResults.style.display = 'block';
    } finally {
        testToolBtn.disabled = false;
        testToolBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Execute Tool (Sandbox)';
    }
}

// Display test result
function displayTestResult(result) {
    const testToolResultsContent = document.getElementById('testToolResultsContent');

    let html = '<div class="alert ' + (result.success ? 'alert-success' : 'alert-error') + '">';
    html += '<h4>' + (result.success ? '✓ Success' : '✗ Failed') + '</h4>';
    html += '<p><strong>Tool:</strong> ' + result.toolName + '</p>';
    html += '<p><strong>Sandbox Mode:</strong> ' + (result.sandboxMode ? 'Yes (isolated storage)' : 'No') + '</p>';

    // Display validation errors if present
    if (result.validationErrors && result.validationErrors.length > 0) {
        html += '<div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">';
        html += '<p><strong>❌ Validation Errors:</strong></p>';
        html += '<ul style="margin-left: 1.5rem; margin-bottom: 0;">';
        result.validationErrors.forEach(error => {
            html += '<li style="margin-bottom: 0.25rem;">' + error + '</li>';
        });
        html += '</ul>';
        html += '</div>';
    }

    if (result.result) {
        html += '<p style="margin-top: 1rem;"><strong>Result:</strong></p>';
        html += '<pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto;">' +
            JSON.stringify(result.result, null, 2) + '</pre>';
    }

    if (result.error && !result.validationErrors) {
        html += '<p><strong>Error:</strong> ' + result.error + '</p>';
    }

    if (result.sandboxCleared) {
        html += '<p style="color: #22c55e; margin-top: 1rem;">✓ Sandbox storage cleared after execution</p>';
    }

    html += '</div>';

    testToolResultsContent.innerHTML = html;
}

// Add test to history
function addTestHistory(test) {
    testToolHistory.unshift(test);
    if (testToolHistory.length > 10) {
        testToolHistory = testToolHistory.slice(0, 10);
    }

    const testToolHistory_div = document.getElementById('testToolHistory');
    const testToolHistoryContent = document.getElementById('testToolHistoryContent');

    let html = '';
    testToolHistory.forEach((item, index) => {
        const timestamp = new Date(item.timestamp).toLocaleString();
        const statusClass = item.result.success ? 'alert-success' : 'alert-error';
        const statusIcon = item.result.success ? '✓' : '✗';

        html += '<div class="alert ' + statusClass + '" style="margin-bottom: 0.5rem; padding: 0.75rem;">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
        html += '<strong>' + statusIcon + ' ' + item.toolName + '</strong>';
        html += '<small style="color: #666;">' + timestamp + '</small>';
        html += '</div>';
        html += '<small>Payload: ' + JSON.stringify(item.payload).substring(0, 100) + '...</small>';
        html += '</div>';
    });

    testToolHistoryContent.innerHTML = html;
    testToolHistory_div.style.display = 'block';
}

// Initialize MCP connector when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initMcpConnector();
        initTestTools();
    });
} else {
    initMcpConnector();
    initTestTools();
}
