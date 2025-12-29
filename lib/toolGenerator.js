/**
 * Tool Generator - Auto-generate CRUD tools from OpenDirect schemas
 * Converts Python's schema_adapter.py logic to Node.js
 */

import { randomUUID } from 'crypto';

/**
 * Generate CRUD tools from schemas (truly dynamic)
 * @param {Object} schemas - Object schemas (any format)
 * @param {Object} storage - Storage object to use
 * @returns {Array} Array of generated tool handlers
 */
export function generateCRUDTools(schemas, storage) {
  const tools = [];

  // Dynamically discover all object types from the schemas
  const objectOperations = {};

  for (const schemaKey of Object.keys(schemas)) {
    // Extract object type name (remove "OpenDirect." prefix if present)
    const objType = schemaKey.replace(/^OpenDirect\./, '');

    // Skip if not a valid object schema
    if (!schemas[schemaKey] || typeof schemas[schemaKey] !== 'object') {
      continue;
    }

    // Auto-generate standard CRUD operations for each object
    // Special cases for read-only objects can be handled later
    objectOperations[objType] = ['create', 'update', 'get', 'list'];
  }

  for (const [objType, operations] of Object.entries(objectOperations)) {
    // Try both with and without "OpenDirect." prefix
    let schema = schemas[objType] || schemas[`OpenDirect.${objType}`];

    if (!schema) {
      console.warn(`⚠️  No schema found for ${objType}, skipping`);
      continue;
    }

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
 * Generate tool definitions from schemas (truly dynamic)
 * @param {Object} schemas - Object schemas (any format)
 * @param {Array} existingTools - Existing tool definitions from schema (optional)
 * @returns {Array} Array of tool definitions for MCP
 */
export function generateToolDefinitions(schemas, existingTools = null) {
  // If schema already has tools defined, extract object types from those tools
  // This prevents generating tools for helper/nested schemas
  if (existingTools && Array.isArray(existingTools) && existingTools.length > 0) {
    console.log(`📋 Using existing ${existingTools.length} tool definitions from schema`);
    return existingTools;
  }

  // Otherwise, dynamically generate tools from schemas
  const tools = [];
  const objectOperations = {};

  for (const schemaKey of Object.keys(schemas)) {
    // Extract object type name (remove "OpenDirect." or "AdCOM." prefix if present)
    const objType = schemaKey.replace(/^(OpenDirect\.|AdCOM\.)/, '');

    // Skip if not a valid object schema
    if (!schemas[schemaKey] || typeof schemas[schemaKey] !== 'object') {
      continue;
    }

    // Auto-generate standard CRUD operations for each object
    objectOperations[objType] = ['create', 'update', 'get', 'list'];
  }

  for (const [objType, operations] of Object.entries(objectOperations)) {
    // Try with original prefix first, then without
    const schema = schemas[objType] || schemas[`OpenDirect.${objType}`] || schemas[`AdCOM.${objType}`];
    if (!schema) continue;

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
 * Generate resource definitions from schemas (truly dynamic)
 * @param {Object} schemas - Object schemas (any format)
 * @returns {Array} Array of resource definitions
 */
export function generateResourceDefinitions(schemas) {
  const resources = [];

  // Dynamically discover all object types from the schemas
  for (const schemaKey of Object.keys(schemas)) {
    // Extract object type name (remove "OpenDirect." prefix if present)
    const objType = schemaKey.replace(/^OpenDirect\./, '');

    // Skip if not a valid object schema
    if (!schemas[schemaKey] || typeof schemas[schemaKey] !== 'object') {
      continue;
    }

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
