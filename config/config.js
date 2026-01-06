import { config } from 'dotenv';

// Suppress dotenv stdout messages by temporarily hijacking console.log
const originalLog = console.log;
console.log = () => {};
export const env = process.env.NODE_ENV || 'development';
const envFile = `.env`;
config({ path: envFile });
console.log = originalLog;

// Environment variable validation
function validateEnvVar(name, value, required = false) {
    if (required && !value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

// Required environment variables
export const llmAPIKey = validateEnvVar('LLM_API_KEY', process.env.LLM_API_KEY, false); // Legacy support
export const port = validateEnvVar('PORT', process.env.PORT || '3000', false);

// Model Configuration
export const modelConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || process.env.LLM_API_KEY, // Fallback to legacy key
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        enabled: !!(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY)
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
        enabled: !!process.env.GEMINI_API_KEY
    },
    defaults: {
        analysis: process.env.DEFAULT_ANALYSIS_MODEL || 'openai',
        chat: process.env.DEFAULT_CHAT_MODEL || 'openai'
    }
};

// Optional database configuration (currently unused but kept for future use)
export const db = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

// Optional JWT secret (currently unused)
export const jwtSecret = process.env.JWT_SECRET;

// Log configuration status (only in development)
if (env === 'development') {
    console.error('Configuration loaded:');
    console.error(`- Environment: ${env}`);
    console.error(`- Port: ${port}`);
    console.error(`- Models:`);
    console.error(`  - OpenAI: ${modelConfig.openai.enabled ? `✓ ${modelConfig.openai.model}` : '✗ Not configured'}`);
    console.error(`  - Gemini: ${modelConfig.gemini.enabled ? `✓ ${modelConfig.gemini.model}` : '✗ Not configured'}`);
    console.error(`  - Default Analysis: ${modelConfig.defaults.analysis}`);
    console.error(`  - Default Chat: ${modelConfig.defaults.chat}`);
    // console.error(`- BigQuery Credentials: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'configured' : 'NOT SET'}`);
}

