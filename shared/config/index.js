// Centralized Configuration
import { config as loadEnv } from 'dotenv';

loadEnv();

const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mcp_testing',
    connectionLimit: 10
  },

  // AI Providers
  ai: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-5-20250929'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'
    }
  },

  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://127.0.0.1:3000']
  },

  // Module base paths
  modules: {
    apiTestingMCP: '/mcp',
    opendirectMCP: '/agenticdirect/mcp',
    schemaDrivenMCP: '/schema/mcp',
    a2aProtocol: '/a2a',
    aiChat: '/chat'
  }
};

export default config;
export const { port, env, database, ai, cors, modules } = config;
