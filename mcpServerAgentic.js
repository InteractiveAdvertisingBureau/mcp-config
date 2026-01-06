#!/usr/bin/env node
/**
 * MCP stdio Server for AgenticDirect (OpenDirect v2.1)
 *
 * This is the stdio (Standard Input/Output) transport version for:
 * - Claude Desktop integration
 * - Cline VSCode extension
 * - Continue VSCode extension
 * - Other stdio-based MCP clients
 *
 * For HTTP transport, use mcpServerHttpAgentic.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';

// ============================================
// IN-MEMORY STORAGE
// ============================================

const STORAGE = {
  organizations: {},
  accounts: {},
  orders: {},
  lines: {},
  products: {},
  creatives: {},
  assignments: {},
  change_requests: {},
  messages: {}
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
  return randomUUID();
}

function generateISODate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

// ============================================
// SERVER CREATION
// ============================================

function createAgenticMCPServer() {
  const server = new Server(
    {
      name: 'agenticdirect-mcp-stdio',
      version: '2.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ============================================
  // TOOL DEFINITIONS
  // ============================================

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_organization',
        description: 'Create a new organization (advertiser, agency, or publisher) in OpenDirect v2.1 format',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Organization name' },
            org_type: {
              type: 'string',
              enum: ['Advertiser', 'Agency', 'Publisher'],
              description: 'Organization type'
            },
            contacts: { type: 'array', items: { type: 'object' }, description: 'Contact information' },
            address: { type: 'object', description: 'Organization address' }
          },
          required: ['name']
        }
      },
      {
        name: 'create_account',
        description: 'Create a buyer-advertiser account relationship in OpenDirect v2.1',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Account name' },
            advertiser_id: { type: 'string', description: 'Advertiser organization ID' },
            buyer_id: { type: 'string', description: 'Buyer/Agency organization ID (optional)' }
          },
          required: ['name', 'advertiser_id']
        }
      },
      {
        name: 'create_order',
        description: 'Create an advertising order/campaign in OpenDirect v2.1',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Order/campaign name' },
            account_id: { type: 'string', description: 'Account ID' },
            publisher_id: { type: 'string', description: 'Publisher organization ID' },
            currency: { type: 'string', description: 'Currency code (USD, EUR, etc.)' },
            budget: { type: 'number', description: 'Order budget' },
            start_date: { type: 'string', description: 'Start date (ISO 8601)' },
            end_date: { type: 'string', description: 'End date (ISO 8601)' }
          },
          required: ['name', 'account_id', 'publisher_id', 'currency']
        }
      },
      {
        name: 'create_line',
        description: 'Create a line item within an order',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Line item name' },
            order_id: { type: 'string', description: 'Parent order ID' },
            product_id: { type: 'string', description: 'Product ID' },
            start_date: { type: 'string', description: 'Start date (ISO 8601)' },
            end_date: { type: 'string', description: 'End date (ISO 8601)' },
            rate_type: {
              type: 'string',
              enum: ['CPM', 'CPMV', 'CPC', 'CPD', 'FlatRate'],
              description: 'Rate type'
            },
            quantity: { type: 'integer', description: 'Quantity/impressions' }
          },
          required: ['name', 'order_id']
        }
      },
      {
        name: 'create_creative',
        description: 'Upload/create an ad creative',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Creative name' },
            account_id: { type: 'string', description: 'Account ID' },
            creative_url: { type: 'string', description: 'Creative asset URL (optional)' }
          },
          required: ['name', 'account_id']
        }
      },
      {
        name: 'create_assignment',
        description: 'Assign a creative to a placement/line',
        inputSchema: {
          type: 'object',
          properties: {
            creative_id: { type: 'string', description: 'Creative ID' },
            placement_id: { type: 'string', description: 'Placement/line ID' },
            weight: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              description: 'Assignment weight for rotation (1-100, default: 100)'
            }
          },
          required: ['creative_id', 'placement_id']
        }
      },
      {
        name: 'search_products',
        description: 'Search available advertising products/inventory',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query/filters' },
            publisher_id: { type: 'string', description: 'Filter by publisher ID' },
            currency: { type: 'string', description: 'Filter by currency' }
          }
        }
      },
      {
        name: 'create_change_request',
        description: 'Request changes to an order',
        inputSchema: {
          type: 'object',
          properties: {
            account_id: { type: 'string', description: 'Account ID' },
            order_id: { type: 'string', description: 'Order ID to modify' },
            requester_id: { type: 'string', description: 'ID of user requesting changes' },
            comments: { type: 'string', description: 'Change request comments/details' }
          },
          required: ['account_id', 'order_id', 'requester_id']
        }
      },
      {
        name: 'send_message',
        description: 'Send a message related to an order',
        inputSchema: {
          type: 'object',
          properties: {
            order_id: { type: 'string', description: 'Order ID' },
            message: { type: 'string', description: 'Message content' },
            sender: { type: 'object', description: 'Sender information (optional)' },
            recipient: { type: 'object', description: 'Recipient information (optional)' }
          },
          required: ['order_id', 'message']
        }
      },
      {
        name: 'update_line_booking_status',
        description: 'Update the booking status of a line item',
        inputSchema: {
          type: 'object',
          properties: {
            line_id: { type: 'string', description: 'Line item ID' },
            booking_status: {
              type: 'string',
              description: 'New booking status',
              enum: ['Draft', 'PendingReservation', 'Reserved', 'PendingBooking', 'Booked',
                     'InFlight', 'Finished', 'Stopped', 'Canceled', 'Pause', 'Expired',
                     'Declined', 'ChangePending']
            }
          },
          required: ['line_id', 'booking_status']
        }
      }
    ]
  }));

  // ============================================
  // TOOL HANDLERS
  // ============================================

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'create_organization': {
          const org_id = generateId();
          const org = {
            Id: org_id,
            Name: args.name,
            Status: 'Pending',
            Type: args.org_type || 'Advertiser',
            contacts: args.contacts || [],
            address: args.address || {}
          };
          STORAGE.organizations[org_id] = org;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(org, null, 2)
            }]
          };
        }

        case 'create_account': {
          const account_id = generateId();
          const account = {
            Id: account_id,
            Name: args.name,
            Status: 'Active',
            Advertiser: {
              Id: args.advertiser_id,
              Name: `Advertiser ${args.advertiser_id.substring(0, 8)}`
            }
          };

          // Add buyer/agency if provided
          if (args.buyer_id) {
            account.Agency = {
              Id: args.buyer_id,
              Name: `Agency ${args.buyer_id.substring(0, 8)}`
            };
          }

          STORAGE.accounts[account_id] = account;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(account, null, 2)
            }]
          };
        }

        case 'create_order': {
          const order_id = generateId();
          const order = {
            Id: order_id,
            Name: args.name,
            AccountId: args.account_id,
            Status: 'Draft',
            publisherid: args.publisher_id,
            currency: args.currency,
            budget: args.budget,
            StartDate: args.start_date || generateISODate(30),
            EndDate: args.end_date || generateISODate(37)
          };
          STORAGE.orders[order_id] = order;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(order, null, 2)
            }]
          };
        }

        case 'create_line': {
          const line_id = generateId();
          const line = {
            Id: line_id,
            Name: args.name,
            OrderId: args.order_id,
            ProductId: args.product_id,
            Status: 'Draft',
            StartDate: args.start_date || generateISODate(30),
            EndDate: args.end_date || generateISODate(37),
            ratetype: args.rate_type,
            quantity: args.quantity
          };
          STORAGE.lines[line_id] = line;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(line, null, 2)
            }]
          };
        }

        case 'create_creative': {
          const creative_id = generateId();
          const creative = {
            Id: creative_id,
            Name: args.name,
            AccountId: args.account_id,
            Status: 'Active'
          };

          // Add creative file/URL if provided
          if (args.creative_url) {
            creative.File = {
              Url: args.creative_url,
              MimeType: 'image/jpeg'
            };
          }

          STORAGE.creatives[creative_id] = creative;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(creative, null, 2)
            }]
          };
        }

        case 'create_assignment': {
          const assignment_id = generateId();
          const assignment = {
            Id: assignment_id,
            CreativeId: args.creative_id,
            PlacementId: args.placement_id,
            Status: 'Active',
            weight: args.weight || 100
          };
          STORAGE.assignments[assignment_id] = assignment;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(assignment, null, 2)
            }]
          };
        }

        case 'search_products': {
          // Return mock product data matching Python server
          const pub_id = args.publisher_id || 'pub_123';
          const curr = args.currency || 'USD';

          const products = [
            {
              Id: generateId(),
              Name: 'Homepage Banner 728x90',
              Status: 'Active',
              publisherid: pub_id,
              currency: curr,
              baseprice: 10.50,
              ratetype: 'CPM',
              AdUnit: {
                Id: 'adunit_1',
                Name: 'Banner 728x90'
              }
            },
            {
              Id: generateId(),
              Name: 'Video Pre-Roll 30s',
              Status: 'Active',
              publisherid: pub_id,
              currency: curr,
              baseprice: 25.00,
              ratetype: 'CPM',
              AdUnit: {
                Id: 'adunit_2',
                Name: 'Video 30s'
              }
            }
          ];

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(products, null, 2)
            }]
          };
        }

        case 'create_change_request': {
          const cr_id = generateId();
          const changeRequest = {
            Id: cr_id,
            AccountId: args.account_id,
            OrderId: args.order_id,
            RequesterId: args.requester_id,
            Status: 'Pending',
            comments: args.comments || '',
            RequestDate: generateISODate()
          };
          STORAGE.change_requests[cr_id] = changeRequest;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(changeRequest, null, 2)
            }]
          };
        }

        case 'send_message': {
          const message_id = generateId();
          const message = {
            Id: message_id,
            OrderId: args.order_id,
            Status: 'New',
            message: args.message,
            messagedate: generateISODate()
          };
          STORAGE.messages[message_id] = message;

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(message, null, 2)
            }]
          };
        }

        case 'update_line_booking_status': {
          const line_id = args.line_id;
          if (STORAGE.lines[line_id]) {
            STORAGE.lines[line_id].Status = args.booking_status;
            return {
              content: [{
                type: 'text',
                text: JSON.stringify(STORAGE.lines[line_id], null, 2)
              }]
            };
          } else {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({ error: 'Line not found' }, null, 2)
              }],
              isError: true
            };
          }
        }

        default:
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2)
            }],
            isError: true
          };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name
          }, null, 2)
        }],
        isError: true
      };
    }
  });

  // ============================================
  // RESOURCE DEFINITIONS
  // ============================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'opendirect://organizations',
        name: 'Organizations',
        description: 'All organizations (advertisers, agencies, publishers)',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://accounts',
        name: 'Accounts',
        description: 'All buyer-advertiser accounts',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://orders',
        name: 'Orders',
        description: 'All advertising orders',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://lines',
        name: 'Lines',
        description: 'All line items',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://products',
        name: 'Products',
        description: 'Available advertising products',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://creatives',
        name: 'Creatives',
        description: 'All ad creatives',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://assignments',
        name: 'Assignments',
        description: 'Creative-to-placement assignments',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://change_requests',
        name: 'Change Requests',
        description: 'Order change requests',
        mimeType: 'application/json'
      },
      {
        uri: 'opendirect://messages',
        name: 'Messages',
        description: 'Order-related messages',
        mimeType: 'application/json'
      }
    ]
  }));

  // ============================================
  // RESOURCE HANDLERS
  // ============================================

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    try {
      const resourceType = uri.replace('opendirect://', '');

      if (STORAGE[resourceType]) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(Object.values(STORAGE[resourceType]), null, 2)
          }]
        };
      }

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: `Unknown resource: ${uri}` }, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ error: error.message }, null, 2)
        }]
      };
    }
  });

  return server;
}

// ============================================
// MAIN - stdio TRANSPORT
// ============================================

async function main() {
  console.error('🔗 Initializing AgenticDirect MCP stdio server...');

  const server = createAgenticMCPServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('✅ AgenticDirect MCP stdio server running');
  console.error('📋 Available: 10 OpenDirect v2.1 tools, 9 resources');
  console.error('🔌 Transport: stdio (stdin/stdout)');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
