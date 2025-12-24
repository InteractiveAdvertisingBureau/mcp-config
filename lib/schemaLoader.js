/**
 * Schema Loader - Load and parse OpenDirect MCP schemas
 * Converts from Python's schema-driven approach to Node.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load OpenDirect MCP Schema
 * @param {string} schemaPath - Path to schema JSON file
 * @returns {Object} Parsed schema
 */
export function loadSchema(schemaPath = null) {
  const path = schemaPath || join(__dirname, '../opendirect-mcp-schema.json');

  try {
    const schemaContent = readFileSync(path, 'utf-8');
    const schema = JSON.parse(schemaContent);

    console.log(`✅ Schema loaded: ${schema.name} v${schema.version}`);
    return schema;
  } catch (error) {
    console.error(`❌ Failed to load schema from ${path}:`, error.message);
    throw error;
  }
}

/**
 * Load MCP Manifest
 * @param {string} manifestPath - Path to manifest JSON file
 * @returns {Object} Parsed manifest
 */
export function loadManifest(manifestPath = null) {
  const path = manifestPath || join(__dirname, '../mcp-manifest.json');

  try {
    const manifestContent = readFileSync(path, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    console.log(`✅ Manifest loaded: ${manifest.name}`);
    return manifest;
  } catch (error) {
    console.error(`❌ Failed to load manifest from ${path}:`, error.message);
    throw error;
  }
}

/**
 * Extract tools from schema
 * @param {Object} schema - OpenDirect schema
 * @returns {Array} Array of tool definitions
 */
export function extractTools(schema) {
  if (!schema.tools || !Array.isArray(schema.tools)) {
    console.warn('⚠️  No tools found in schema');
    return [];
  }

  console.log(`📋 Extracted ${schema.tools.length} tools from schema`);
  return schema.tools;
}

/**
 * Extract resources from schema
 * @param {Object} schema - OpenDirect schema
 * @returns {Array} Array of resource definitions
 */
export function extractResources(schema) {
  if (!schema.resources || !Array.isArray(schema.resources)) {
    console.warn('⚠️  No resources found in schema');
    return [];
  }

  console.log(`📋 Extracted ${schema.resources.length} resources from schema`);
  return schema.resources;
}

/**
 * Get schema definitions for OpenDirect objects
 * @param {Object} schema - OpenDirect schema
 * @returns {Object} Schema definitions keyed by object type
 */
export function extractSchemas(schema) {
  if (!schema.schemas || typeof schema.schemas !== 'object') {
    console.warn('⚠️  No object schemas found');
    return {};
  }

  const schemaCount = Object.keys(schema.schemas).length;
  console.log(`📋 Extracted ${schemaCount} object schemas`);
  return schema.schemas;
}

/**
 * Merge schema with manifest
 * @param {Object} schema - OpenDirect schema
 * @param {Object} manifest - MCP manifest
 * @param {string} implementation - Which implementation to use
 * @returns {Object} Complete configuration
 */
export function mergeConfig(schema, manifest, implementation = 'nodejs-http') {
  const impl = manifest.implementations?.[implementation];

  if (!impl) {
    console.warn(`⚠️  Implementation '${implementation}' not found, using defaults`);
  }

  const config = {
    name: schema.name || manifest.name,
    version: schema.version || manifest.version,
    description: schema.description || manifest.description,

    // Transport configuration
    transport: impl?.transport || 'http',

    // From schema
    tools: extractTools(schema),
    resources: extractResources(schema),
    schemas: extractSchemas(schema),

    // Metadata
    metadata: {
      ...schema.metadata,
      implementation: implementation
    },

    // Capabilities
    capabilities: manifest.capabilities || {
      tools: true,
      resources: true,
      prompts: false,
      logging: true
    }
  };

  console.log(`✅ Configuration merged for implementation: ${implementation}`);
  return config;
}

/**
 * Load complete configuration
 * @param {Object} options - Configuration options
 * @returns {Object} Complete MCP configuration
 */
export function loadConfig(options = {}) {
  const {
    schemaPath = null,
    manifestPath = null,
    implementation = 'nodejs-http'
  } = options;

  console.log('🔧 Loading MCP configuration...');

  const schema = loadSchema(schemaPath);
  const manifest = loadManifest(manifestPath);
  const config = mergeConfig(schema, manifest, implementation);

  console.log('✅ Configuration loaded successfully');
  console.log(`   - Tools: ${config.tools.length}`);
  console.log(`   - Resources: ${config.resources.length}`);
  console.log(`   - Schemas: ${Object.keys(config.schemas).length}`);

  return config;
}

export default {
  loadSchema,
  loadManifest,
  extractTools,
  extractResources,
  extractSchemas,
  mergeConfig,
  loadConfig
};
