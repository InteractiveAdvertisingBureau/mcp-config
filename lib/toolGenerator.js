/**
 * Tool Generator - Auto-generate CRUD tools from OpenDirect schemas
 * Converts Python's schema_adapter.py logic to Node.js
 */

import { randomUUID } from 'crypto';

/**
 * Generate CRUD tools from OpenDirect schemas
 * @param {Object} schemas - OpenDirect object schemas
 * @param {Object} storage - Storage object to use
 * @returns {Array} Array of generated tool handlers
 */
export function generateCRUDTools(schemas, storage) {
  const tools = [];

  // Map of main objects to their CRUD operations
  const objectOperations = {
    'Account': ['create', 'update', 'get', 'list'],
    'Order': ['create', 'update', 'get', 'list'],
    'Line': ['create', 'update', 'get', 'list'],
    'Creative': ['create', 'update', 'get', 'list'],
    'Assignment': ['create', 'delete', 'get', 'list'],
    'Organization': ['create', 'update', 'get', 'list'],
    'Product': ['get', 'list', 'search'],
    'ChangeRequest': ['create', 'get', 'list'],
    'Message': ['create', 'get', 'list']
  };

  for (const [objType, operations] of Object.entries(objectOperations)) {
    const schemaKey = `OpenDirect.${objType}`;
    if (!schemas[schemaKey]) {
      console.warn(`⚠️  No schema found for ${objType}, skipping`);
      continue;
    }

    const schema = schemas[schemaKey];
    const storageKey = objType.toLowerCase() + 's';

    for (const operation of operations) {
      const toolHandler = generateToolHandler(objType, operation, schema, storage, storageKey);
      if (toolHandler) {
        tools.push(toolHandler);
      }
    }
  }

  console.log(`✅ Generated ${tools.length} CRUD tools`);
  return tools;
}

/**
 * Generate a single tool handler
 */
function generateToolHandler(objType, operation, schema, storage, storageKey) {
  const toolName = `${operation}_${objType.toLowerCase()}`;

  switch (operation) {
    case 'create':
      return {
        name: toolName,
        handler: async (args) => {
          const id = generateId();
          const obj = {
            Id: id,
            ...args
          };

          // Initialize storage if needed
          if (!storage[storageKey]) {
            storage[storageKey] = {};
          }

          storage[storageKey][id] = obj;

          return {
            success: true,
            message: `${objType} created successfully`,
            data: obj
          };
        }
      };

    case 'get':
      return {
        name: toolName,
        handler: async (args) => {
          const { id } = args;

          if (!storage[storageKey] || !storage[storageKey][id]) {
            return {
              success: false,
              error: `${objType} not found: ${id}`
            };
          }

          return {
            success: true,
            data: storage[storageKey][id]
          };
        }
      };

    case 'list':
      return {
        name: toolName,
        handler: async (args) => {
          const items = storage[storageKey] ? Object.values(storage[storageKey]) : [];

          return {
            success: true,
            total: items.length,
            data: items
          };
        }
      };

    case 'update':
      return {
        name: toolName,
        handler: async (args) => {
          const { id, ...updates } = args;

          if (!storage[storageKey] || !storage[storageKey][id]) {
            return {
              success: false,
              error: `${objType} not found: ${id}`
            };
          }

          storage[storageKey][id] = {
            ...storage[storageKey][id],
            ...updates
          };

          return {
            success: true,
            message: `${objType} updated successfully`,
            data: storage[storageKey][id]
          };
        }
      };

    case 'delete':
      return {
        name: toolName,
        handler: async (args) => {
          const { id } = args;

          if (!storage[storageKey] || !storage[storageKey][id]) {
            return {
              success: false,
              error: `${objType} not found: ${id}`
            };
          }

          delete storage[storageKey][id];

          return {
            success: true,
            message: `${objType} deleted successfully`
          };
        }
      };

    case 'search':
      return {
        name: toolName,
        handler: async (args) => {
          const { query } = args;
          const items = storage[storageKey] ? Object.values(storage[storageKey]) : [];

          // Simple search implementation
          const results = query
            ? items.filter(item =>
                JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
              )
            : items;

          return {
            success: true,
            total: results.length,
            data: results
          };
        }
      };

    default:
      console.warn(`⚠️  Unknown operation: ${operation}`);
      return null;
  }
}

/**
 * Generate tool definitions from schemas
 * @param {Object} schemas - OpenDirect schemas
 * @returns {Array} Array of tool definitions for MCP
 */
export function generateToolDefinitions(schemas) {
  const tools = [];

  const objectOperations = {
    'Account': ['create', 'update', 'get', 'list'],
    'Order': ['create', 'update', 'get', 'list'],
    'Line': ['create', 'update', 'get', 'list'],
    'Creative': ['create', 'update', 'get', 'list'],
    'Assignment': ['create', 'delete', 'get', 'list'],
    'Organization': ['create', 'update', 'get', 'list'],
    'Product': ['get', 'list', 'search'],
    'ChangeRequest': ['create', 'get', 'list'],
    'Message': ['create', 'get', 'list']
  };

  for (const [objType, operations] of Object.entries(objectOperations)) {
    const schemaKey = `OpenDirect.${objType}`;
    if (!schemas[schemaKey]) continue;

    const schema = schemas[schemaKey];

    for (const operation of operations) {
      const toolDef = generateToolDefinition(objType, operation, schema);
      if (toolDef) {
        tools.push(toolDef);
      }
    }
  }

  return tools;
}

/**
 * Generate a single tool definition
 */
function generateToolDefinition(objType, operation, schema) {
  const toolName = `${operation}_${objType.toLowerCase()}`;
  const descriptions = {
    create: `Create a new ${objType}`,
    update: `Update an existing ${objType}`,
    get: `Get a ${objType} by ID`,
    list: `List all ${objType}s`,
    delete: `Delete a ${objType}`,
    search: `Search ${objType}s`
  };

  const inputSchemas = {
    create: {
      type: 'object',
      properties: schema.properties || {},
      required: schema.required || []
    },
    update: {
      type: 'object',
      properties: {
        id: { type: 'string', description: `${objType} ID to update` },
        ...schema.properties
      },
      required: ['id']
    },
    get: {
      type: 'object',
      properties: {
        id: { type: 'string', description: `${objType} ID` }
      },
      required: ['id']
    },
    list: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Maximum number of results' },
        offset: { type: 'integer', description: 'Number of results to skip' }
      }
    },
    delete: {
      type: 'object',
      properties: {
        id: { type: 'string', description: `${objType} ID to delete` }
      },
      required: ['id']
    },
    search: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' }
      }
    }
  };

  return {
    name: toolName,
    description: descriptions[operation] || `${operation} ${objType}`,
    inputSchema: inputSchemas[operation] || { type: 'object' }
  };
}

/**
 * Generate resource definitions from schemas
 * @param {Object} schemas - OpenDirect schemas
 * @returns {Array} Array of resource definitions
 */
export function generateResourceDefinitions(schemas) {
  const resources = [];

  const mainObjects = [
    'Account', 'Order', 'Line', 'Creative', 'Assignment',
    'Organization', 'Product', 'ChangeRequest', 'Message'
  ];

  for (const objType of mainObjects) {
    const schemaKey = `OpenDirect.${objType}`;
    if (!schemas[schemaKey]) continue;

    resources.push({
      uri: `opendirect://${objType.toLowerCase()}s`,
      name: `${objType}s`,
      description: `All ${objType} objects`,
      mimeType: 'application/json'
    });
  }

  return resources;
}

/**
 * Generate ID
 */
function generateId() {
  return randomUUID();
}

/**
 * Generate ISO date
 */
function generateISODate(daysOffset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

export default {
  generateCRUDTools,
  generateToolDefinitions,
  generateResourceDefinitions,
  generateId,
  generateISODate
};
