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
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

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

// Mount MCP endpoints BEFORE catch-all route
const mcpApp = createMCPHttpApp();
app.use('/mcp', mcpApp);

// Mount REST API BEFORE catch-all route
app.use('/api', mcpRoutes);




// Catch-all route for SPA (must be AFTER API/MCP routes)
app.get(/^\/(?!api|mcp).*/, function (req, res) {
  res.sendFile(path.join(__dirname, 'client/ui', 'index.html'));
})




export default app;