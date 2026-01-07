/**
 * Schema Storage - Centralized storage for custom schemas
 * Avoids circular dependencies between app.js and schemaLoader.js
 */

let customSchema = null;
let schemaHistory = [];

/**
 * Get the current custom schema
 * @returns {Object|null} Custom schema or null if using default
 */
export function getCustomSchema() {
  return customSchema;
}

/**
 * Set a custom schema
 * @param {Object} schema - The schema object
 */
export function setCustomSchema(schema) {
  customSchema = schema;
}

/**
 * Clear the custom schema (revert to default)
 */
export function clearCustomSchema() {
  customSchema = null;
}

/**
 * Add schema to history
 * @param {Object} entry - History entry
 */
export function addToHistory(entry) {
  schemaHistory.unshift(entry);
  // Keep only last 10
  if (schemaHistory.length > 10) {
    schemaHistory = schemaHistory.slice(0, 10);
  }
}

/**
 * Get schema history
 * @returns {Array} Schema registration history
 */
export function getHistory() {
  return schemaHistory;
}

/**
 * Check if using custom schema
 * @returns {boolean}
 */
export function isUsingCustomSchema() {
  return customSchema !== null;
}
