// services/analyzerService.js
import * as toolRequestValidator from "./toolRequestValidator.js";


const toolMap = {
  "request-validator": toolRequestValidator
};

export async function runDiagnostic({ domain, recommended_tool, user_agents }) {
  // Validate inputs
  if (!domain || typeof domain !== 'string') {
    throw new Error('Invalid domain parameter');
  }

  if (!recommended_tool || typeof recommended_tool !== 'string') {
    throw new Error('Invalid recommended_tool parameter');
  }

  const tool = toolMap[recommended_tool];
  if (!tool) {
    throw new Error(`Unknown tool: ${recommended_tool}. Available tools: ${Object.keys(toolMap).join(', ')}`);
  }

  // Ensure user_agents is an array
  const agents = Array.isArray(user_agents) ? user_agents : ['default'];

  if (agents.length === 0) {
    throw new Error('user_agents array cannot be empty');
  }

  // Limit number of user agents to prevent abuse
  if (agents.length > 10) {
    throw new Error('Maximum 10 user agents allowed per diagnostic');
  }

  let results = [];
  const errors = [];

  // Run diagnostics with error handling for each user agent
  for (const ua of agents) {
    try {
      const res = await tool.test({ domain, userAgent: ua });
      results.push({ userAgent: ua, ...res });
    } catch (error) {
      console.error(`Error testing with user agent "${ua}":`, error);
      errors.push({
        userAgent: ua,
        error: error.message
      });
    }
  }

  // If all tests failed, throw error
  if (results.length === 0 && errors.length > 0) {
    throw new Error(`All diagnostic tests failed. Errors: ${JSON.stringify(errors)}`);
  }

  // Include errors in results if some tests succeeded
  if (errors.length > 0) {
    results.push({
      _errors: errors,
      _note: 'Some tests failed'
    });
  }

  return results;
}
