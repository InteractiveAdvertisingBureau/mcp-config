/**
 * Sample Flow - MCP Workflow Testing
 * Handles MCP server connection, individual tool testing, and workflow execution
 */

// Get base URL dynamically
function getBaseUrl() {
    return window.location.protocol + '//' + window.location.host;
}

// Realistic dataset for workflow placeholders
const REALISTIC_DATA = {
    agencies: [
        'Ogilvy Digital',
        'Wieden+Kennedy',
        'BBDO Worldwide',
        'Publicis Media',
        'Havas Group',
        'Dentsu Aegis',
        'GroupM',
        'Omnicom Media',
        'IPG Mediabrands',
        'WPP Digital'
    ],
    advertisers: [
        'Nike',
        'Coca-Cola',
        'Apple',
        'Samsung',
        'Toyota',
        'McDonald\'s',
        'Microsoft',
        'Amazon',
        'Pepsi',
        'BMW',
        'Adidas',
        'Unilever',
        'P&G',
        'Netflix',
        'Disney'
    ],
    publishers: [
        'The New York Times',
        'CNN Digital',
        'ESPN Media',
        'Forbes',
        'BuzzFeed',
        'Vox Media',
        'Business Insider',
        'The Guardian',
        'Washington Post',
        'Vice Media',
        'Conde Nast',
        'Hearst Digital',
        'BBC News',
        'Reuters',
        'Bloomberg Media'
    ],
    accounts: [
        'Spring Campaign 2024',
        'Holiday Season Marketing',
        'Product Launch Q1',
        'Brand Awareness Initiative',
        'Summer Promotion',
        'Back to School Campaign',
        'Black Friday Special',
        'New Year Campaign',
        'Sports Sponsorship',
        'Digital Transformation'
    ],
    orders: [
        'Display Campaign March',
        'Video Pre-Roll Package',
        'Mobile App Install Campaign',
        'Retargeting Initiative',
        'Programmatic Buy Q2',
        'Native Advertising Push',
        'Social Media Amplification',
        'Brand Safety Premium',
        'Performance Marketing',
        'Awareness & Engagement'
    ],
    lines: [
        'Desktop Display - Premium',
        'Mobile Video 15s',
        'Native Content Units',
        'Rich Media Takeover',
        'Video Pre-Roll 30s',
        'Mobile Banner 320x50',
        'Interstitial Mobile',
        'Tablet Display',
        'Connected TV',
        'Audio Streaming Ads'
    ],
    creatives: [
        'Spring Sale Hero Banner',
        'Product Demo Video 30s',
        'Brand Story Native Ad',
        'Interactive Rich Media',
        'Holiday Special Creative',
        'Lifestyle Image Set',
        'Testimonial Video',
        'Animated Display Ad',
        'App Install Creative',
        'Limited Time Offer Banner'
    ]
};

// Get random item from array
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Generate realistic workflow data
function generateRealisticWorkflowData() {
    return {
        BUYER_ORG_NAME: getRandomItem(REALISTIC_DATA.agencies),
        ADVERTISER_ORG_NAME: getRandomItem(REALISTIC_DATA.advertisers),
        PUBLISHER_ORG_NAME: getRandomItem(REALISTIC_DATA.publishers),
        ACCOUNT_NAME: getRandomItem(REALISTIC_DATA.accounts),
        ORDER_NAME: getRandomItem(REALISTIC_DATA.orders),
        LINE_NAME: getRandomItem(REALISTIC_DATA.lines),
        CREATIVE_NAME: getRandomItem(REALISTIC_DATA.creatives),
        PUBLISHER_ID: 'pub_' + Math.random().toString(36).substr(2, 9)
    };
}

// Global state
let flowMcpConnection = {
    connected: false,
    serverUrl: '',
    serverName: '',
    role: 'buyer',
    tools: [],
    eventSource: null
};

let workflowExecution = {
    isRunning: false,
    currentStep: 0,
    steps: [],
    results: [],
    variables: {} // Store variables from previous steps for use in next steps
};

// Initialize Sample Flow tab
function initSampleFlow() {
    // Connect button
    document.getElementById('flowConnectBtn').addEventListener('click', handleFlowConnect);

    // Tab switching
    document.querySelectorAll('.flow-test-tab').forEach(tab => {
        tab.addEventListener('click', handleFlowTabSwitch);
    });

    // Individual tool testing
    document.getElementById('flowToolSelect').addEventListener('change', handleFlowToolChange);
    document.getElementById('flowExecuteToolBtn').addEventListener('click', handleFlowExecuteTool);
    document.getElementById('flowGenerateSampleBtn').addEventListener('click', handleFlowGenerateSample);
    document.getElementById('flowClearToolBtn').addEventListener('click', handleFlowClearTool);

    // Workflow testing
    document.getElementById('flowWorkflowTemplate').addEventListener('change', handleFlowWorkflowTemplateChange);
    document.getElementById('flowExecuteWorkflowBtn').addEventListener('click', handleFlowExecuteWorkflow);
    document.getElementById('flowAddStepBtn').addEventListener('click', handleFlowAddStep);

    // Role change handler
    document.querySelectorAll('input[name="flowRole"]').forEach(radio => {
        radio.addEventListener('change', handleFlowRoleChange);
    });
}

// Handle tab switching between Individual and Workflow testing
function handleFlowTabSwitch(e) {
    const targetTab = e.currentTarget.dataset.tab;

    // Update tab buttons
    document.querySelectorAll('.flow-test-tab').forEach(tab => {
        tab.classList.remove('active');
        tab.style.borderBottomColor = 'transparent';
        tab.style.color = '#666';
    });

    e.currentTarget.classList.add('active');
    e.currentTarget.style.borderBottomColor = '#0066cc';
    e.currentTarget.style.color = '#0066cc';

    // Show/hide tab content
    if (targetTab === 'individual') {
        document.getElementById('flowIndividualTab').style.display = 'block';
        document.getElementById('flowWorkflowTab').style.display = 'none';
    } else if (targetTab === 'workflow') {
        document.getElementById('flowIndividualTab').style.display = 'none';
        document.getElementById('flowWorkflowTab').style.display = 'block';
    }
}

// Handle MCP server connection
async function handleFlowConnect() {
    const serverPath = document.getElementById('flowMcpServer').value;
    const role = document.querySelector('input[name="flowRole"]:checked').value;

    if (!serverPath) {
        showToast('Please select an MCP server', 'error');
        return;
    }

    try {
        showLoading(true);

        const baseUrl = getBaseUrl();
        const fullUrl = baseUrl + serverPath;

        // Fetch tools using the backend API endpoint (handles JSON-RPC communication)
        const response = await fetch(baseUrl + '/api/mcp/get-tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: fullUrl })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch tools from MCP server');
        }

        if (!data.tools || data.tools.length === 0) {
            throw new Error('No tools available from this MCP server');
        }

        // Update connection state
        flowMcpConnection = {
            connected: true,
            serverUrl: fullUrl,
            serverName: document.getElementById('flowMcpServer').selectedOptions[0].text,
            role: role,
            tools: data.tools,
            eventSource: null
        };

        // Update UI
        updateFlowConnectionUI();
        populateFlowTools();

        showToast(`Connected to ${flowMcpConnection.serverName}`, 'success');
    } catch (error) {
        showToast(`Connection failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Update connection UI
function updateFlowConnectionUI() {
    document.getElementById('flowConnectionStatus').style.display = flowMcpConnection.connected ? 'block' : 'none';
    document.getElementById('flowMainContent').style.display = flowMcpConnection.connected ? 'block' : 'none';

    if (flowMcpConnection.connected) {
        document.getElementById('flowServerName').textContent = flowMcpConnection.serverName;
        document.getElementById('flowToolsCount').textContent = flowMcpConnection.tools.length;
        document.getElementById('flowCurrentRole').textContent = flowMcpConnection.role.charAt(0).toUpperCase() + flowMcpConnection.role.slice(1);
        document.getElementById('flowConnectBtn').textContent = 'Reconnect';

        // Update workflow templates based on role
        updateWorkflowTemplatesForRole();
    }
}

// Populate tools dropdown
function populateFlowTools() {
    const select = document.getElementById('flowToolSelect');
    select.innerHTML = '<option value="">-- Select a tool --</option>';

    flowMcpConnection.tools.forEach(tool => {
        const option = document.createElement('option');
        option.value = tool.name;
        option.textContent = tool.name;
        option.dataset.description = tool.description || '';
        option.dataset.schema = JSON.stringify(tool.inputSchema || {});
        select.appendChild(option);
    });
}

// Handle tool selection change
function handleFlowToolChange(e) {
    const select = e.target;
    const selectedOption = select.selectedOptions[0];

    if (selectedOption && selectedOption.value) {
        const description = selectedOption.dataset.description;
        document.getElementById('flowToolDescText').textContent = description || 'No description available';
        document.getElementById('flowToolDescription').style.display = 'block';
    } else {
        document.getElementById('flowToolDescription').style.display = 'none';
    }
}

// Handle individual tool execution
async function handleFlowExecuteTool() {
    const toolName = document.getElementById('flowToolSelect').value;
    const payloadText = document.getElementById('flowToolPayload').value.trim();

    if (!toolName) {
        showToast('Please select a tool', 'error');
        return;
    }

    // Find the tool definition for validation
    const tool = flowMcpConnection.tools.find(t => t.name === toolName);

    let payload = {};
    if (payloadText) {
        try {
            payload = JSON.parse(payloadText);
        } catch (error) {
            showToast('Invalid JSON payload', 'error');
            return;
        }
    }

    // Validate payload against tool's input schema
    if (tool && tool.inputSchema) {
        const validation = validatePayloadAgainstSchema(payload, tool.inputSchema);
        if (!validation.valid) {
            const errorMsg = 'Payload validation failed:\n' + validation.errors.join('\n');
            showToast(errorMsg, 'error');
            displayFlowToolValidationError(toolName, payload, validation.errors);
            return;
        }
    }

    try {
        showLoading(true);

        const result = await executeMcpTool(toolName, payload);
        displayFlowToolResult(toolName, payload, result);

        showToast('Tool executed successfully', 'success');
    } catch (error) {
        showToast(`Tool execution failed: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// Validate payload against JSON schema
function validatePayloadAgainstSchema(payload, schema) {
    const errors = [];

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
        for (const requiredField of schema.required) {
            if (!(requiredField in payload)) {
                errors.push(`Missing required field: "${requiredField}"`);
            }
        }
    }

    // Check field types and constraints
    if (schema.properties) {
        for (const [fieldName, fieldValue] of Object.entries(payload)) {
            const fieldSchema = schema.properties[fieldName];

            if (!fieldSchema) {
                continue; // Allow extra fields
            }

            // Type validation
            if (fieldSchema.type) {
                if (fieldSchema.type === 'integer' || fieldSchema.type === 'number') {
                    if (typeof fieldValue !== 'number') {
                        errors.push(`Field "${fieldName}" must be a number, got ${typeof fieldValue}`);
                    }
                } else if (fieldSchema.type === 'string') {
                    if (typeof fieldValue !== 'string') {
                        errors.push(`Field "${fieldName}" must be a string, got ${typeof fieldValue}`);
                    }
                } else if (fieldSchema.type === 'boolean') {
                    if (typeof fieldValue !== 'boolean') {
                        errors.push(`Field "${fieldName}" must be a boolean, got ${typeof fieldValue}`);
                    }
                } else if (fieldSchema.type === 'array') {
                    if (!Array.isArray(fieldValue)) {
                        errors.push(`Field "${fieldName}" must be an array, got ${typeof fieldValue}`);
                    }
                } else if (fieldSchema.type === 'object') {
                    if (typeof fieldValue !== 'object' || Array.isArray(fieldValue)) {
                        errors.push(`Field "${fieldName}" must be an object, got ${typeof fieldValue}`);
                    }
                }
            }

            // Enum validation
            if (fieldSchema.enum && !fieldSchema.enum.includes(fieldValue)) {
                errors.push(`Field "${fieldName}" must be one of: ${fieldSchema.enum.join(', ')}`);
            }

            // String constraints
            if (fieldSchema.type === 'string' && typeof fieldValue === 'string') {
                if (fieldSchema.minLength && fieldValue.length < fieldSchema.minLength) {
                    errors.push(`Field "${fieldName}" must be at least ${fieldSchema.minLength} characters`);
                }
                if (fieldSchema.maxLength && fieldValue.length > fieldSchema.maxLength) {
                    errors.push(`Field "${fieldName}" must be at most ${fieldSchema.maxLength} characters`);
                }
                if (fieldSchema.pattern) {
                    const regex = new RegExp(fieldSchema.pattern);
                    if (!regex.test(fieldValue)) {
                        errors.push(`Field "${fieldName}" does not match required pattern`);
                    }
                }
            }

            // Number constraints
            if ((fieldSchema.type === 'integer' || fieldSchema.type === 'number') && typeof fieldValue === 'number') {
                if (fieldSchema.minimum !== undefined && fieldValue < fieldSchema.minimum) {
                    errors.push(`Field "${fieldName}" must be at least ${fieldSchema.minimum}`);
                }
                if (fieldSchema.maximum !== undefined && fieldValue > fieldSchema.maximum) {
                    errors.push(`Field "${fieldName}" must be at most ${fieldSchema.maximum}`);
                }
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

// Display validation errors for individual tool testing
function displayFlowToolValidationError(toolName, payload, errors) {
    const resultDiv = document.getElementById('flowToolResultContent');

    const html = `
        <div style="background: white; border: 1px solid #ef4444; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <strong style="color: #991b1b;">Validation Failed: ${toolName}</strong>
            </div>

            <div style="margin-bottom: 1rem;">
                <strong>Request Payload:</strong>
                <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow-x: auto; margin-top: 0.5rem;">${JSON.stringify(payload, null, 2)}</pre>
            </div>

            <div>
                <strong>Validation Errors:</strong>
                <div style="background: #fee2e2; padding: 1rem; border-radius: 4px; margin-top: 0.5rem;">
                    ${errors.map(err => `<div style="color: #991b1b; margin-bottom: 0.5rem;">❌ ${err}</div>`).join('')}
                </div>
            </div>
        </div>
    `;

    resultDiv.innerHTML = html;
    document.getElementById('flowToolResult').style.display = 'block';
}

// Execute MCP tool
async function executeMcpTool(toolName, payload) {
    const baseUrl = getBaseUrl();
    const response = await fetch(baseUrl + '/api/mcp/call-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            serverUrl: flowMcpConnection.serverUrl,
            toolName: toolName,
            parameters: payload
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Tool execution failed');
    }

    return await response.json();
}

// Display tool execution result
function displayFlowToolResult(toolName, payload, result) {
    const resultDiv = document.getElementById('flowToolResultContent');

    // Format the result for better display
    const formattedResult = formatMcpResult(result);

    const html = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <strong style="color: #059669;">Tool: ${toolName}</strong>
            </div>

            <div style="margin-bottom: 1rem;">
                <strong>Request Payload:</strong>
                <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 300px; margin-top: 0.5rem; font-size: 0.875rem;">${JSON.stringify(payload, null, 2)}</pre>
            </div>

            <div>
                <strong>Response:</strong>
                <div style="background: #f0f9ff; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 400px; margin-top: 0.5rem;">
                    ${formattedResult}
                </div>
            </div>
        </div>
    `;

    resultDiv.innerHTML = html;
    document.getElementById('flowToolResult').style.display = 'block';
}

// Format MCP result for better display
function formatMcpResult(result) {
    // Check if result has the nested structure: result.result.content[0].text
    let dataToFormat = result;

    // If result has a 'result' property (from API wrapper)
    if (result.result) {
        dataToFormat = result.result;
    }

    // If result has content array with text, parse and format it
    if (dataToFormat.content && Array.isArray(dataToFormat.content) && dataToFormat.content.length > 0) {
        const textContent = dataToFormat.content[0].text;
        if (textContent) {
            try {
                const parsed = JSON.parse(textContent);
                // Format the parsed JSON with proper indentation
                return `<pre style="margin: 0; font-size: 0.875rem; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>`;
            } catch (e) {
                // If not JSON, display as formatted text
                return `<pre style="margin: 0; font-size: 0.875rem; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(textContent)}</pre>`;
            }
        }
    }
    // Fallback to standard JSON formatting
    return `<pre style="margin: 0; font-size: 0.875rem; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(JSON.stringify(dataToFormat, null, 2))}</pre>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Generate sample payload
function handleFlowGenerateSample() {
    const toolName = document.getElementById('flowToolSelect').value;

    if (!toolName) {
        showToast('Please select a tool first', 'error');
        return;
    }

    const tool = flowMcpConnection.tools.find(t => t.name === toolName);
    if (!tool || !tool.inputSchema) {
        showToast('No schema available for this tool', 'error');
        return;
    }

    const sample = generateSampleFromSchema(tool.inputSchema);
    document.getElementById('flowToolPayload').value = JSON.stringify(sample, null, 2);
}

// Generate sample payload from JSON schema
function generateSampleFromSchema(schema) {
    const sample = {};

    if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            if (prop.enum && prop.enum.length > 0) {
                sample[key] = prop.enum[0];
            } else if (prop.type === 'string') {
                // Use realistic data based on field name
                sample[key] = getRealisticValueForField(key, prop);
            } else if (prop.type === 'integer' || prop.type === 'number') {
                sample[key] = prop.example || 1;
            } else if (prop.type === 'boolean') {
                sample[key] = false;
            } else if (prop.type === 'array') {
                sample[key] = [];
            } else if (prop.type === 'object') {
                sample[key] = prop.properties ? generateSampleFromSchema(prop) : {};
            }
        }
    }

    return sample;
}

// Get realistic value based on field name
function getRealisticValueForField(fieldName, fieldSchema) {
    const lowerField = fieldName.toLowerCase();

    // Check if field has enum values
    if (fieldSchema.enum && fieldSchema.enum.length > 0) {
        return fieldSchema.enum[0];
    }

    // Organization/Company names
    if (lowerField.includes('org') && lowerField.includes('name')) {
        if (lowerField.includes('buyer') || lowerField.includes('agency')) {
            return getRandomItem(REALISTIC_DATA.agencies);
        } else if (lowerField.includes('publisher') || lowerField.includes('seller')) {
            return getRandomItem(REALISTIC_DATA.publishers);
        } else if (lowerField.includes('advertiser')) {
            return getRandomItem(REALISTIC_DATA.advertisers);
        }
        // Default organization
        return getRandomItem(REALISTIC_DATA.agencies);
    }

    // Account related
    if (lowerField.includes('account') && lowerField.includes('name')) {
        return getRandomItem(REALISTIC_DATA.accounts);
    }

    // Order related
    if (lowerField.includes('order') && lowerField.includes('name')) {
        return getRandomItem(REALISTIC_DATA.orders);
    }

    // Line related
    if (lowerField.includes('line') && lowerField.includes('name')) {
        return getRandomItem(REALISTIC_DATA.lines);
    }

    // Creative related
    if (lowerField.includes('creative') && lowerField.includes('name')) {
        return getRandomItem(REALISTIC_DATA.creatives);
    }

    // Name field (generic)
    if (lowerField === 'name') {
        return getRandomItem(REALISTIC_DATA.accounts);
    }

    // Organization type
    if (lowerField.includes('org') && lowerField.includes('type')) {
        return 'Advertiser';
    }

    // IDs - generate realistic looking IDs
    if (lowerField.includes('id') || lowerField.includes('_id')) {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    // URL fields
    if (lowerField.includes('url') || lowerField.includes('link')) {
        return 'https://example.com/campaign';
    }

    // Email fields
    if (lowerField.includes('email')) {
        return 'contact@example.com';
    }

    // Phone fields
    if (lowerField.includes('phone') || lowerField.includes('tel')) {
        return '+1-555-0100';
    }

    // Default to example or generic value
    return fieldSchema.example || `sample_${fieldName}`;
}

// Clear tool testing area
function handleFlowClearTool() {
    document.getElementById('flowToolPayload').value = '';
    document.getElementById('flowToolResult').style.display = 'none';
    document.getElementById('flowToolResultContent').innerHTML = '';
}

// Handle role change
function handleFlowRoleChange(e) {
    flowMcpConnection.role = e.target.value;
    if (flowMcpConnection.connected) {
        document.getElementById('flowCurrentRole').textContent =
            flowMcpConnection.role.charAt(0).toUpperCase() + flowMcpConnection.role.slice(1);

        // Update workflow templates based on role
        updateWorkflowTemplatesForRole();
    }
}

// Update workflow templates based on selected role
function updateWorkflowTemplatesForRole() {
    const templateSelect = document.getElementById('flowWorkflowTemplate');

    // Get all buyer and seller options
    const buyerOptions = templateSelect.querySelectorAll('#flowBuyerTemplates option');
    const sellerOptions = templateSelect.querySelectorAll('#flowSellerTemplates option');

    if (flowMcpConnection.role === 'buyer') {
        // Show buyer options, hide seller options
        buyerOptions.forEach(opt => {
            opt.disabled = false;
            opt.style.display = '';
        });
        sellerOptions.forEach(opt => {
            opt.disabled = true;
            opt.style.display = 'none';
        });
    } else if (flowMcpConnection.role === 'seller') {
        // Show seller options, hide buyer options
        buyerOptions.forEach(opt => {
            opt.disabled = true;
            opt.style.display = 'none';
        });
        sellerOptions.forEach(opt => {
            opt.disabled = false;
            opt.style.display = '';
        });
    }

    // Reset the workflow selection
    templateSelect.value = '';
    workflowExecution.steps = [];
    document.getElementById('flowExecuteWorkflowBtn').disabled = true;

    // Hide custom workflow builder if it was shown
    document.getElementById('flowCustomWorkflow').style.display = 'none';

    // Clear any previous workflow results
    document.getElementById('flowDiagram').style.display = 'none';
    document.getElementById('flowStepResults').style.display = 'none';
}

// Handle workflow template change
function handleFlowWorkflowTemplateChange(e) {
    const template = e.target.value;

    if (template === 'custom') {
        document.getElementById('flowCustomWorkflow').style.display = 'block';
        document.getElementById('flowExecuteWorkflowBtn').disabled = false;
        initializeCustomWorkflow();
    } else if (template) {
        document.getElementById('flowCustomWorkflow').style.display = 'none';
        document.getElementById('flowExecuteWorkflowBtn').disabled = false;
        loadWorkflowTemplate(template);
    } else {
        document.getElementById('flowCustomWorkflow').style.display = 'none';
        document.getElementById('flowExecuteWorkflowBtn').disabled = true;
        workflowExecution.steps = [];
    }
}

// Load predefined workflow template
function loadWorkflowTemplate(templateId) {
    // Get available tool names from connected MCP server
    const availableTools = flowMcpConnection.tools.map(t => t.name);

    const templates = {
        'buyer-simple': {
            name: 'Buyer: Simple Order Flow',
            steps: [
                {
                    tool: 'create_organization',
                    description: 'Create buyer organization',
                    payload: {
                        name: '{{BUYER_ORG_NAME}}',
                        org_type: 'Agency'
                    },
                    extractVariables: {
                        organizationId: 'data.Id'
                    }
                },
                {
                    tool: 'create_organization',
                    description: 'Create advertiser organization',
                    payload: {
                        name: '{{ADVERTISER_ORG_NAME}}',
                        org_type: 'Advertiser'
                    },
                    extractVariables: {
                        advertiserOrgId: 'data.Id'
                    }
                },
                {
                    tool: 'create_account',
                    description: 'Create advertiser account',
                    payload: {
                        name: '{{ACCOUNT_NAME}}',
                        advertiser_id: '{{step2.advertiserOrgId}}',
                        buyer_id: '{{step1.organizationId}}'
                    },
                    extractVariables: {
                        accountId: 'data.Id'
                    }
                },
                {
                    tool: 'create_order',
                    description: 'Create advertising order',
                    payload: {
                        account_id: '{{step3.accountId}}',
                        name: '{{ORDER_NAME}}'
                    },
                    extractVariables: {
                        orderId: 'data.Id'
                    }
                },
                {
                    tool: 'create_line',
                    description: 'Create line item',
                    payload: {
                        order_id: '{{step4.orderId}}',
                        name: '{{LINE_NAME}}'
                    },
                    extractVariables: {
                        lineId: 'data.Id'
                    }
                }
            ]
        },
        'buyer-complete': {
            name: 'Buyer: Complete Campaign',
            steps: [
                {
                    tool: 'create_organization',
                    description: 'Create buyer organization',
                    payload: {
                        name: '{{BUYER_ORG_NAME}}',
                        org_type: 'Agency'
                    },
                    extractVariables: {
                        buyerOrgId: 'data.Id'
                    }
                },
                {
                    tool: 'create_organization',
                    description: 'Create advertiser organization',
                    payload: {
                        name: '{{ADVERTISER_ORG_NAME}}',
                        org_type: 'Advertiser'
                    },
                    extractVariables: {
                        advertiserOrgId: 'data.Id'
                    }
                },
                {
                    tool: 'create_account',
                    description: 'Create account linking buyer and advertiser',
                    payload: {
                        name: '{{ACCOUNT_NAME}}',
                        advertiser_id: '{{step2.advertiserOrgId}}',
                        buyer_id: '{{step1.buyerOrgId}}'
                    },
                    extractVariables: {
                        accountId: 'data.Id'
                    }
                },
                {
                    tool: 'search_products',
                    description: 'Search available ad inventory',
                    payload: {
                        publisher_id: '{{PUBLISHER_ID}}'
                    },
                    extractVariables: {}
                },
                {
                    tool: 'create_order',
                    description: 'Create advertising order',
                    payload: {
                        account_id: '{{step3.accountId}}',
                        name: '{{ORDER_NAME}}'
                    },
                    extractVariables: {
                        orderId: 'data.Id'
                    }
                },
                {
                    tool: 'create_line',
                    description: 'Create line item',
                    payload: {
                        order_id: '{{step5.orderId}}',
                        name: '{{LINE_NAME}}'
                    },
                    extractVariables: {
                        lineId: 'data.Id'
                    }
                },
                {
                    tool: 'create_creative',
                    description: 'Create ad creative',
                    payload: {
                        account_id: '{{step3.accountId}}',
                        name: '{{CREATIVE_NAME}}'
                    },
                    extractVariables: {
                        creativeId: 'data.Id'
                    }
                },
                {
                    tool: 'create_assignment',
                    description: 'Assign creative to line',
                    payload: {
                        line_id: '{{step6.lineId}}',
                        creative_id: '{{step7.creativeId}}'
                    },
                    extractVariables: {
                        assignmentId: 'data.Id'
                    }
                }
            ]
        },
        'buyer-approval': {
            name: 'Buyer: With Approval Flow',
            steps: [
                {
                    tool: 'create_organization',
                    description: 'Create buyer organization',
                    payload: {
                        name: '{{BUYER_ORG_NAME}}',
                        org_type: 'Agency'
                    },
                    extractVariables: {
                        buyerOrgId: 'data.Id'
                    }
                },
                {
                    tool: 'create_organization',
                    description: 'Create advertiser organization',
                    payload: {
                        name: '{{ADVERTISER_ORG_NAME}}',
                        org_type: 'Advertiser'
                    },
                    extractVariables: {
                        advertiserOrgId: 'data.Id'
                    }
                },
                {
                    tool: 'create_account',
                    description: 'Create account',
                    payload: {
                        name: '{{ACCOUNT_NAME}}',
                        advertiser_id: '{{step2.advertiserOrgId}}',
                        buyer_id: '{{step1.buyerOrgId}}'
                    },
                    extractVariables: {
                        accountId: 'data.Id'
                    }
                },
                {
                    tool: 'create_order',
                    description: 'Create order',
                    payload: {
                        account_id: '{{step3.accountId}}',
                        name: '{{ORDER_NAME}}'
                    },
                    extractVariables: {
                        orderId: 'data.Id'
                    }
                },
                {
                    tool: 'create_line',
                    description: 'Create line item',
                    payload: {
                        order_id: '{{step4.orderId}}',
                        name: '{{LINE_NAME}}'
                    },
                    extractVariables: {
                        lineId: 'data.Id'
                    }
                },
                {
                    tool: 'update_line_booking_status',
                    description: 'Submit line for approval (PendingReservation)',
                    payload: {
                        line_id: '{{step5.lineId}}',
                        booking_status: 'PendingReservation'
                    },
                    extractVariables: {}
                }
            ]
        },
        'seller-setup': {
            name: 'Seller: Organization Setup',
            steps: [
                {
                    tool: 'create_organization',
                    description: 'Create publisher organization',
                    payload: {
                        name: '{{PUBLISHER_ORG_NAME}}',
                        org_type: 'Publisher'
                    },
                    extractVariables: {
                        organizationId: 'data.Id'
                    }
                }
            ]
        },
        'seller-approval': {
            name: 'Seller: Order Review & Approval',
            steps: [
                {
                    tool: 'create_organization',
                    description: 'Create publisher organization',
                    payload: {
                        name: '{{PUBLISHER_ORG_NAME}}',
                        org_type: 'Publisher'
                    },
                    extractVariables: {
                        publisherOrgId: 'data.Id'
                    }
                }
            ]
        }
    };

    const template = templates[templateId];
    if (template) {
        // Log available tools for debugging
        console.log('Available tools:', availableTools);
        console.log('Template steps:', template.steps.map(s => s.tool));

        // Check if ALL tools from template are available
        const missingTools = [];
        for (const step of template.steps) {
            if (!availableTools.includes(step.tool)) {
                missingTools.push(step.tool);
            }
        }

        if (missingTools.length > 0) {
            const message = `Cannot load workflow template: ${template.name}\n\nMissing tools in connected MCP server:\n- ${missingTools.join('\n- ')}\n\nPlease connect to a compatible MCP server or choose a different template.`;
            showToast(message, 'error');
            workflowExecution.steps = [];
            document.getElementById('flowExecuteWorkflowBtn').disabled = true;
            return;
        }

        // All tools are available
        workflowExecution.steps = template.steps;
        showToast(`Loaded template: ${template.name} (${template.steps.length} steps)`, 'success');
        document.getElementById('flowExecuteWorkflowBtn').disabled = false;
    }
}

// Initialize custom workflow builder
function initializeCustomWorkflow() {
    workflowExecution.steps = [];
    document.getElementById('flowWorkflowSteps').innerHTML = '';
}

// Add step to custom workflow
function handleFlowAddStep() {
    const stepNumber = workflowExecution.steps.length + 1;
    const stepHtml = `
        <div class="workflow-step" data-step="${stepNumber}" style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <h4>Step ${stepNumber}</h4>
            <div class="form-group">
                <label>Tool</label>
                <select class="form-control workflow-tool-select" data-step="${stepNumber}">
                    <option value="">-- Select tool --</option>
                    ${flowMcpConnection.tools.map(t => `<option value="${t.name}">${t.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Description</label>
                <input type="text" class="form-control workflow-step-desc" data-step="${stepNumber}" placeholder="What does this step do?" />
            </div>
            <div class="form-group">
                <label>Payload (JSON)</label>
                <textarea class="form-control workflow-step-payload" data-step="${stepNumber}" rows="4" placeholder='Use {{step1.variableName}} to reference previous step results'></textarea>
            </div>
            <button type="button" class="btn btn-secondary btn-sm workflow-remove-step" data-step="${stepNumber}">Remove Step</button>
        </div>
    `;

    document.getElementById('flowWorkflowSteps').insertAdjacentHTML('beforeend', stepHtml);

    // Add event listener for remove button
    document.querySelector(`.workflow-remove-step[data-step="${stepNumber}"]`).addEventListener('click', function() {
        this.closest('.workflow-step').remove();
    });
}

// Execute workflow
async function handleFlowExecuteWorkflow() {
    if (workflowExecution.isRunning) {
        showToast('Workflow is already running', 'error');
        return;
    }

    try {
        workflowExecution.isRunning = true;
        workflowExecution.currentStep = 0;
        workflowExecution.results = [];
        workflowExecution.variables = {};

        // Generate realistic data for this workflow execution
        workflowExecution.realisticData = generateRealisticWorkflowData();

        // Show diagram and results sections
        document.getElementById('flowDiagram').style.display = 'block';
        document.getElementById('flowStepResults').style.display = 'block';

        // Clear previous results
        document.getElementById('flowStepResultsContent').innerHTML = '';

        // Initialize visual diagram
        initializeFlowDiagram();

        // Execute each step
        for (let i = 0; i < workflowExecution.steps.length; i++) {
            workflowExecution.currentStep = i;
            const step = workflowExecution.steps[i];

            // Update diagram to show current step
            updateFlowDiagram(i, 'running');

            try {
                // Process payload to replace variables
                const processedPayload = processWorkflowPayload(step.payload);

                // Execute tool
                const apiResponse = await executeMcpTool(step.tool, processedPayload);

                // The API returns { success: true, result: actualToolResult }
                // So we need to extract from apiResponse.result
                const toolResult = apiResponse.result || apiResponse;

                // Extract variables from result
                if (step.extractVariables) {
                    extractVariablesFromResult(toolResult, step.extractVariables, i + 1);
                }

                // Store result
                workflowExecution.results.push({
                    step: i + 1,
                    tool: step.tool,
                    description: step.description,
                    payload: processedPayload,
                    result: toolResult,
                    apiResponse: apiResponse, // Store full API response for debugging
                    status: 'success',
                    extractedVariables: step.extractVariables || {}
                });

                // Update diagram
                updateFlowDiagram(i, 'success');

                // Display step result
                displayWorkflowStepResult(i);

            } catch (error) {
                // Store error result
                workflowExecution.results.push({
                    step: i + 1,
                    tool: step.tool,
                    description: step.description,
                    payload: step.payload,
                    error: error.message,
                    status: 'error'
                });

                // Update diagram
                updateFlowDiagram(i, 'error');

                // Display error
                displayWorkflowStepResult(i);

                throw error;
            }
        }

        showToast('Workflow completed successfully!', 'success');

    } catch (error) {
        showToast(`Workflow failed at step ${workflowExecution.currentStep + 1}: ${error.message}`, 'error');
    } finally {
        workflowExecution.isRunning = false;
    }
}

// Process workflow payload to replace variable placeholders
function processWorkflowPayload(payload) {
    const payloadStr = JSON.stringify(payload);
    let processed = payloadStr;

    // Replace {{stepN.variable}} with actual values
    const regex = /"?\{\{step(\d+)\.(\w+)\}\}"?/g;
    processed = processed.replace(regex, (match, stepNum, varName) => {
        const key = `step${stepNum}.${varName}`;
        if (workflowExecution.variables[key] !== undefined) {
            const value = workflowExecution.variables[key];
            // If the value is a string, keep it as a quoted string
            // If it's a number, boolean, or object, use JSON.stringify
            if (typeof value === 'string') {
                return `"${value}"`;
            }
            return JSON.stringify(value);
        }
        return match; // Keep placeholder if variable not found
    });

    // Replace {{CONSTANT}} with realistic data
    processed = processed.replace(/"?\{\{(\w+)\}\}"?/g, (match, constant) => {
        // Use realistic data if available
        if (workflowExecution.realisticData && workflowExecution.realisticData[constant]) {
            return `"${workflowExecution.realisticData[constant]}"`;
        }
        // Fallback to generic value
        return `"${constant.toLowerCase()}_value"`;
    });

    return JSON.parse(processed);
}

// Extract variables from tool execution result
function extractVariablesFromResult(result, extractConfig, stepNumber) {
    // MCP tools return: { content: [{ type: 'text', text: '{"success":true,"data":{...}}' }] }
    // We need to parse the text content first
    let parsedData = result;

    if (result.content && Array.isArray(result.content) && result.content.length > 0) {
        const textContent = result.content[0].text;
        if (textContent && typeof textContent === 'string') {
            // Check if this is an error message
            if (textContent.startsWith('❌')) {
                console.error('Tool execution failed:', textContent);
                throw new Error(textContent);
            }

            try {
                parsedData = JSON.parse(textContent);
            } catch (e) {
                console.warn('Failed to parse MCP tool response text:', e);
                console.warn('Response text:', textContent);
                throw new Error(`Failed to parse tool response: ${textContent.substring(0, 100)}`);
            }
        }
    }

    for (const [varName, path] of Object.entries(extractConfig)) {
        const value = getValueByPath(parsedData, path);
        const key = `step${stepNumber}.${varName}`;
        workflowExecution.variables[key] = value;
        console.log(`Extracted ${key} = ${value} from path: ${path}`);
    }
}

// Get value from object by dot notation path
function getValueByPath(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Initialize flow diagram
function initializeFlowDiagram() {
    const content = document.getElementById('flowDiagramContent');
    const steps = workflowExecution.steps;

    let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

    steps.forEach((step, index) => {
        html += `
            <div id="flowStep${index}" style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;" id="flowStepIcon${index}">
                    ${index + 1}
                </div>
                <div style="flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem;">
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${step.tool}</div>
                    <div style="font-size: 0.875rem; color: #666;">${step.description || 'No description'}</div>
                </div>
            </div>
        `;

        if (index < steps.length - 1) {
            html += `
                <div style="margin-left: 20px; width: 2px; height: 20px; background: #e2e8f0;"></div>
            `;
        }
    });

    html += '</div>';
    content.innerHTML = html;
}

// Update flow diagram step status
function updateFlowDiagram(stepIndex, status) {
    const icon = document.getElementById(`flowStepIcon${stepIndex}`);

    if (status === 'running') {
        icon.style.background = '#fbbf24';
        icon.style.color = 'white';
        icon.innerHTML = '⏳';
    } else if (status === 'success') {
        icon.style.background = '#10b981';
        icon.style.color = 'white';
        icon.innerHTML = '✓';
    } else if (status === 'error') {
        icon.style.background = '#ef4444';
        icon.style.color = 'white';
        icon.innerHTML = '✗';
    }
}

// Display workflow step result
function displayWorkflowStepResult(stepIndex) {
    const stepResult = workflowExecution.results[stepIndex];
    const container = document.getElementById('flowStepResultsContent');

    const statusColor = stepResult.status === 'success' ? '#10b981' : '#ef4444';
    const statusIcon = stepResult.status === 'success' ? '✓' : '✗';

    // Format the result for better display
    const formattedResult = stepResult.status === 'success' ? formatMcpResult(stepResult.result) : '';

    const html = `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${statusColor}; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                    ${statusIcon}
                </div>
                <strong>Step ${stepResult.step}: ${stepResult.tool}</strong>
            </div>

            ${stepResult.description ? `<div style="margin-bottom: 1rem; color: #666;">${stepResult.description}</div>` : ''}

            <div style="margin-bottom: 1rem;">
                <strong>Request Payload:</strong>
                <pre style="background: #f8f9fa; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 250px; margin-top: 0.5rem; font-size: 0.875rem;">${JSON.stringify(stepResult.payload, null, 2)}</pre>
            </div>

            ${stepResult.status === 'success' ? `
                <div style="margin-bottom: 1rem;">
                    <strong>Response:</strong>
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 350px; margin-top: 0.5rem;">
                        ${formattedResult}
                    </div>
                </div>

                ${Object.keys(stepResult.extractedVariables).length > 0 ? `
                    <div>
                        <strong>Extracted Variables:</strong>
                        <div style="background: #fef3c7; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.875rem; overflow: auto; max-height: 150px;">
                            ${Object.entries(stepResult.extractedVariables).map(([varName, path]) => {
                                const value = workflowExecution.variables[`step${stepResult.step}.${varName}`];
                                return `<div style="margin-bottom: 0.25rem;"><code>step${stepResult.step}.${varName}</code> = <code>${JSON.stringify(value)}</code></div>`;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            ` : `
                <div>
                    <strong>Error:</strong>
                    <pre style="background: #fee2e2; padding: 1rem; border-radius: 4px; overflow: auto; max-height: 200px; margin-top: 0.5rem; color: #991b1b; font-size: 0.875rem;">${stepResult.error}</pre>
                </div>
            `}
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initSampleFlow);
