# API Testing System with MCP Integration

An AI-powered API testing platform that registers, tests, and analyzes APIs with multiple scenarios. Built with MCP (Model Context Protocol) integration and MySQL database.

## Architecture

Based on screenshot_2 architecture:
```
Browser → Register API → MCP Server → AI LLM → Testing Tool → Middleware → Database
```

## Features

- **API Registration**: Register any REST API endpoint with customizable parameters
- **Multi-Scenario Testing**: Test APIs with multiple scenarios (different params, headers, auth)
- **AI Analysis**: Automatic AI-powered analysis of test results and recommendations
- **Performance Metrics**: Track response times, success rates, and detailed statistics
- **MCP Integration**: Compatible with Claude Desktop and other MCP clients
- **MySQL Storage**: Persistent storage of APIs, test results, and AI metadata

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up MySQL Database

Create the database:
```bash
mysql -u root -p
CREATE DATABASE mcp_api_testing;
exit;
```

Run the schema:
```bash
mysql -u root -p mcp_api_testing < database/schema.sql
```

### 3. Configure Environment

Update `.env` file with your MySQL credentials and API keys:
```env
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=mcp_api_testing

OPENAI_API_KEY=your_key_here
```

### 4. Start the Server

```bash
npm start
```

Visit http://localhost:3000 to access the browser interface.

## API Endpoints

- `POST /api/register` - Register new API
- `GET /api/apis` - List all APIs
- `POST /api/test/:id` - Test API with scenarios
- `GET /api/test/:id/results` - Get test results
- `GET /api/stats/:id` - Get API statistics

## Author

Siraj M - IAB Tech Lab