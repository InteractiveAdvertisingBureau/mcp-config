import { multiModelService } from "./multiModelService.js";

/**
 * Analyze error with LLM to determine root cause and diagnostic approach
 * @param {string} provider - Optional provider override ('openai', 'gemini', or 'default')
 */
export async function analyzeErrorWithLLM({ domain, error_message, fileType = 'ads.txt', filepath = '', provider = 'default' }) {
  const prompt = `
Domain: ${domain}
File Type: ${fileType}
File Path: ${filepath}
Error: ${error_message}

You are an expert in web crawling and diagnosing issues with ads.txt, app-ads.txt, and sellers.json files.

First, categorize this error into one of two types:
- "VALIDATION_ERROR" - Errors related to file content, parsing, format, schema validation, invalid data, subdomain rules, or content validation. These are NOT network/access issues.
- "ACCESS_ERROR" - Errors related to network connectivity, HTTP requests, DNS, SSL, timeouts, redirects, robots.txt blocking, user-agent blocking, server errors (404, 500, etc.).

Then analyze the error and determine:
1. The error category (VALIDATION_ERROR or ACCESS_ERROR)
2. The likely root cause of the error (be specific)
3. Which diagnostic tool should be used (ONLY if ACCESS_ERROR):
   - "axios-client" - RECOMMENDED for most cases - tests both HTTP and HTTPS, fetches file content, checks format validity
   - "wheregoes" - for redirect chains, DNS resolution, 301/302 issues
   - "browser-mimic" - for JavaScript rendering, cookie/session requirements, CAPTCHA detection
   - "curl" - for plain HTTP requests, SSL issues, robots.txt blocking, basic connectivity
4. Whether to test with multiple user-agents (ALWAYS include "IAB-Tech-Lab" as the first user-agent to test) - ONLY if ACCESS_ERROR
5. Specific recommendations for fixing the issue

Respond in JSON format:
{
  "error_category": "VALIDATION_ERROR | ACCESS_ERROR",
  "cause": "Brief description of the likely root cause",
  "recommended_tool": "axios-client | wheregoes | browser-mimic | curl | none",
  "user_agents": ["IAB-Tech-Lab", "...other user-agents if needed..."],
  "reasoning": "Why you categorized it this way and chose this tool",
  "fix_recommendations": "Specific steps to fix the issue",
  "requires_diagnostic_tools": true or false
}

IMPORTANT:
- Set "requires_diagnostic_tools" to false for VALIDATION_ERROR
- Set "recommended_tool" to "none" for VALIDATION_ERROR
- Prefer "axios-client" for ACCESS_ERROR as it provides comprehensive testing`;

  const response = await multiModelService.analyze(prompt, { provider });
  return JSON.parse(response.content);
}

/**
 * Generate final summary from all diagnostic results
 * @param {string} provider - Optional provider override ('openai', 'gemini', or 'default')
 */
export async function generateDiagnosticSummary({ domain, fileType, filepath, originalError, analysis, diagnosticResults, provider = 'default' }) {
  const prompt = `
You are an expert in web crawling diagnostics. Generate a comprehensive summary for a web UI.

Domain: ${domain}
File Type: ${fileType}
File Path: ${filepath}
Original Error: ${JSON.stringify(originalError)}

Analysis:
${JSON.stringify(analysis, null, 2)}

Diagnostic Test Results:
${JSON.stringify(diagnosticResults, null, 2)}

Based on all the diagnostic results, provide a comprehensive summary in JSON format:
{
  "status": "SUCCESS | PARTIAL_SUCCESS | FAILED",
  "root_cause": "The definitive root cause based on test results",
  "user_agent_impact": "How different user-agents affected the results",
  "detailed_findings": [
    "Finding 1",
    "Finding 2"
  ],
  "recommendations": [
    "Recommendation 1",
    "Recommendation 2"
  ],
  "next_steps": "What should be done to resolve this issue"
}`;

  const response = await multiModelService.analyze(prompt, { provider });
  return JSON.parse(response.content);
}
