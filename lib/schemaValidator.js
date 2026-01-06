/**
 * Schema Validator - Validate OpenDirect objects against schemas
 * Provides runtime validation for MCP tool inputs and outputs
 */

/**
 * Validate object against schema
 * @param {any} data - Data to validate
 * @param {Object} schema - JSON schema to validate against
 * @returns {Object} Validation result {valid: boolean, errors: Array}
 */
export function validateAgainstSchema(data, schema) {
  const errors = [];

  if (!schema) {
    return { valid: true, errors: [] };
  }

  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    const expectedType = schema.type.toLowerCase();

    if (actualType !== expectedType) {
      errors.push({
        field: 'root',
        message: `Expected type '${expectedType}', got '${actualType}'`,
        expected: expectedType,
        actual: actualType
      });
      return { valid: false, errors };
    }
  }

  // Object property validation
  if (schema.type === 'object' && schema.properties) {
    validateObjectProperties(data, schema, errors);
  }

  // Array validation
  if (schema.type === 'array' && schema.items) {
    validateArrayItems(data, schema, errors);
  }

  // Required fields
  if (schema.required && Array.isArray(schema.required)) {
    validateRequiredFields(data, schema.required, errors);
  }

  // Enum validation
  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      errors.push({
        field: 'value',
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        expected: schema.enum,
        actual: data
      });
    }
  }

  // String constraints
  if (schema.type === 'string') {
    validateStringConstraints(data, schema, errors);
  }

  // Number constraints
  if (schema.type === 'number' || schema.type === 'integer') {
    validateNumberConstraints(data, schema, errors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function validateObjectProperties(data, schema, errors) {
  if (typeof data !== 'object' || data === null) return;

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    if (data.hasOwnProperty(propName)) {
      const result = validateAgainstSchema(data[propName], propSchema);
      if (!result.valid) {
        errors.push(...result.errors.map(err => ({
          ...err,
          field: `${propName}.${err.field}`
        })));
      }
    }
  }
}

function validateArrayItems(data, schema, errors) {
  if (!Array.isArray(data)) return;

  data.forEach((item, index) => {
    const result = validateAgainstSchema(item, schema.items);
    if (!result.valid) {
      errors.push(...result.errors.map(err => ({
        ...err,
        field: `[${index}].${err.field}`
      })));
    }
  });
}

function validateRequiredFields(data, required, errors) {
  for (const field of required) {
    if (!data || !data.hasOwnProperty(field) || data[field] === undefined || data[field] === null) {
      errors.push({
        field,
        message: `Required field '${field}' is missing`,
        expected: 'present',
        actual: 'missing'
      });
    }
  }
}

function validateStringConstraints(data, schema, errors) {
  if (typeof data !== 'string') return;

  if (schema.minLength !== undefined && data.length < schema.minLength) {
    errors.push({
      field: 'length',
      message: `String length ${data.length} is less than minimum ${schema.minLength}`,
      expected: `>= ${schema.minLength}`,
      actual: data.length
    });
  }

  if (schema.maxLength !== undefined && data.length > schema.maxLength) {
    errors.push({
      field: 'length',
      message: `String length ${data.length} exceeds maximum ${schema.maxLength}`,
      expected: `<= ${schema.maxLength}`,
      actual: data.length
    });
  }

  if (schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(data)) {
      errors.push({
        field: 'pattern',
        message: `String does not match pattern: ${schema.pattern}`,
        expected: schema.pattern,
        actual: data
      });
    }
  }
}

function validateNumberConstraints(data, schema, errors) {
  if (typeof data !== 'number') return;

  if (schema.minimum !== undefined && data < schema.minimum) {
    errors.push({
      field: 'value',
      message: `Value ${data} is less than minimum ${schema.minimum}`,
      expected: `>= ${schema.minimum}`,
      actual: data
    });
  }

  if (schema.maximum !== undefined && data > schema.maximum) {
    errors.push({
      field: 'value',
      message: `Value ${data} exceeds maximum ${schema.maximum}`,
      expected: `<= ${schema.maximum}`,
      actual: data
    });
  }

  if (schema.type === 'integer' && !Number.isInteger(data)) {
    errors.push({
      field: 'type',
      message: `Expected integer, got decimal: ${data}`,
      expected: 'integer',
      actual: 'decimal'
    });
  }
}

/**
 * Validate OpenDirect object
 * @param {Object} obj - OpenDirect object to validate
 * @param {string} objectType - Type of object (e.g., 'Account', 'Order')
 * @param {Object} schemas - All OpenDirect schemas
 * @returns {Object} Validation result
 */
export function validateOpenDirectObject(obj, objectType, schemas) {
  const schemaKey = `OpenDirect.${objectType}`;
  const schema = schemas[schemaKey];

  if (!schema) {
    console.warn(`⚠️  No schema found for ${objectType}`);
    return { valid: true, errors: [], warnings: [`No schema for ${objectType}`] };
  }

  const result = validateAgainstSchema(obj, schema);

  if (!result.valid) {
    console.error(`❌ Validation failed for ${objectType}:`, result.errors);
  } else {
    console.log(`✅ ${objectType} validation passed`);
  }

  return result;
}

/**
 * Validate tool arguments
 * @param {Object} args - Arguments to validate
 * @param {Object} toolSchema - Tool's inputSchema
 * @param {string} toolName - Name of the tool
 * @returns {Object} Validation result
 */
export function validateToolArguments(args, toolSchema, toolName) {
  if (!toolSchema || !toolSchema.inputSchema) {
    return { valid: true, errors: [], warnings: [`No schema for tool ${toolName}`] };
  }

  const result = validateAgainstSchema(args, toolSchema.inputSchema);

  if (!result.valid) {
    console.error(`❌ Invalid arguments for tool '${toolName}':`, result.errors);
  }

  return result;
}

/**
 * Format validation errors for display
 * @param {Array} errors - Validation errors
 * @returns {string} Formatted error message
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'No errors';
  }

  return errors.map(err => {
    return `  - ${err.field}: ${err.message}`;
  }).join('\n');
}

/**
 * Create validation middleware for tools
 * @param {Object} schemas - OpenDirect schemas
 * @param {Array} tools - Tool definitions
 * @returns {Function} Validation middleware
 */
export function createValidationMiddleware(schemas, tools) {
  const toolMap = new Map(tools.map(t => [t.name, t]));

  return function validateRequest(toolName, args) {
    const tool = toolMap.get(toolName);

    if (!tool) {
      return {
        valid: false,
        errors: [{ field: 'tool', message: `Unknown tool: ${toolName}` }]
      };
    }

    return validateToolArguments(args, tool, toolName);
  };
}

export default {
  validateAgainstSchema,
  validateOpenDirectObject,
  validateToolArguments,
  formatValidationErrors,
  createValidationMiddleware
};
