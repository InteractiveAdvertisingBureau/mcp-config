import express from 'express';
import cors from 'cors';
import bodyParser from "body-parser";
import path from "path"
import { fileURLToPath } from 'url';
import morgan from 'morgan';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();

// Configure CORS with environment-based whitelist
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman, MCP clients)
    if (!origin) return callback(null, true);

    // In production, allow same origin (Cloud Run URL calling itself)
    if (process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }

    // In development, check against whitelist
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(morgan('dev'));

app.use(cors(corsOptions));

// Body parser with increased limit for file validation
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static(path.join(__dirname, 'client/ui')))
app.use(express.static(path.join(__dirname, 'storage')));

import mcpRoutes from './routes/mcpRoutes.js';
import { createMCPHttpApp } from './mcpServerHttp.js';
import { setupAIChat } from './aiChatModule.js';

// MCP server without authentication
const mcpApp = createMCPHttpApp();
app.use('/mcp', mcpApp);

// Mount REST API BEFORE catch-all route
app.use('/api', mcpRoutes);

// Setup AI Chat functionality (adds /chat and /api/ai-chat endpoints)
// Pass environment variables from .env (used by Cloud Run)
// MCP server URL: In Cloud Run, use localhost on same port. Locally, use configured port.
const mcpPort = process.env.PORT || '3000';
const mcpServerUrl = process.env.MCP_SERVER_URL || `http://localhost:${mcpPort}/mcp`;

setupAIChat(app, {
  staticPath: path.join(__dirname, 'client/standalone'),
  mcpServerUrl: mcpServerUrl,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'
}).catch(err => {
  console.error('⚠️  AI Chat setup failed:', err.message);
});

// Catch-all route for SPA (must be AFTER API/MCP routes)
app.get(/^\/(?!api|mcp|chat).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'client/ui', 'index.html'));
})




export default app;