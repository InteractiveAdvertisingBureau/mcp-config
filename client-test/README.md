# A2A Agent Test Client

A standalone HTML/JavaScript client for testing A2A Protocol agents (Buyer and Seller).

## Features

✅ **Browser-based UI** - No build tools or dependencies required
✅ **A2A v0.3.0 Compliant** - Uses standard JSON-RPC methods (`message/send`, `tasks/get`)
✅ **Agent Discovery** - Automatically fetches agent cards from `/.well-known/agent-card.json`
✅ **Real-time Task Polling** - Monitors task status and displays results
✅ **Interactive Chat** - Send messages and see agent responses
✅ **Debug Console** - View all requests and responses
✅ **Quick Actions** - Pre-configured test messages

## How to Use

### 1. Start the Server

Make sure your A2A server is running:

```bash
npm start
```

Server should be running at `http://localhost:3000`

### 2. Open the Client

You have two options:

#### Option A: Using Python HTTP Server (Recommended)

```bash
cd client-test
python3 -m http.server 8080
```

Then open: http://localhost:8080

#### Option B: Using Node.js HTTP Server

```bash
cd client-test
npx http-server -p 8080
```

Then open: http://localhost:8080

#### Option C: Direct File Access

Simply open `client-test/index.html` in your browser.

**Note**: Some browsers may block fetch requests when opening files directly. Using a local server (Option A or B) is recommended.

### 3. Test the Client

1. **Select an Agent**: Choose either Buyer or Seller
2. **Connect**: Click "Connect" to fetch the agent card
3. **Send Messages**: Type a message or use quick actions:
   - "create account for Nike"
   - "search products"
   - "list products"
   - "create order"
4. **Monitor Tasks**: See task status in the "Active Tasks" panel
5. **View Debug Log**: Check the debug console for detailed request/response info

## Architecture

```
Browser Client
    ↓ HTTP POST
/a2a/{role}
    ↓ JSON-RPC 2.0
    {
      "jsonrpc": "2.0",
      "method": "message/send",
      "params": { message: {...} }
    }
    ↓
Agent Executor
    ↓
Task Created & Response
```

## Files

- **index.html** - Main UI structure
- **style.css** - Styling and animations
- **app.js** - Client logic (A2A protocol implementation)
- **README.md** - This file

## Supported Methods

### message/send
Sends a message to the agent and creates a task.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "msg-123",
      "role": "user",
      "parts": [{"kind": "text", "text": "search products"}],
      "kind": "message"
    }
  },
  "id": 1
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "kind": "task",
      "id": "task-456",
      "status": {"state": "working"},
      "history": [...]
    }
  },
  "id": 1
}
```

### tasks/get
Gets the status of a task.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "method": "tasks/get",
  "params": {
    "taskId": "task-456"
  },
  "id": 2
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "task": {
      "id": "task-456",
      "status": {"state": "completed"},
      "history": [...]
    }
  },
  "id": 2
}
```

## Troubleshooting

### CORS Errors

If you see CORS errors in the browser console, make sure:

1. You're using a local HTTP server (not opening file:// directly)
2. The A2A server is running on `http://localhost:3000`
3. Your server has CORS enabled (it should be by default)

### Connection Failed

- Check that the server URL is correct (default: `http://localhost:3000`)
- Verify the A2A server is running (`npm start`)
- Check the browser console and debug log for error details

### No Agent Response

- Check the "Active Tasks" panel to see task status
- Look at the debug log for request/response details
- The agent may still be processing (status: "working")

## Example Test Flow

1. **Connect to Buyer Agent**
   - Agent card shows buyer capabilities

2. **Send**: "create account for Nike"
   - Task created with ID
   - Agent executes `create_account` tool
   - Response shows account created

3. **Send**: "search products"
   - Switch to Seller agent first
   - Agent executes `search_products` tool
   - Response shows available products

4. **Send**: "create order"
   - Back to Buyer agent
   - Agent executes `create_order` tool
   - Response shows order details

## Development

The client is pure HTML/CSS/JavaScript with no build process.

To modify:
1. Edit the files directly
2. Refresh the browser to see changes
3. Check browser console for errors

## Browser Compatibility

Works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Security Note

This is a **test client** for development purposes. Do not use in production without:
- Adding authentication
- Implementing input validation
- Adding rate limiting
- Using HTTPS
