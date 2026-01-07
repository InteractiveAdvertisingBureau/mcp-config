# Test Schemas

This folder contains test schemas for validating the schema-driven MCP server's custom schema registration feature.

## Files

### test-campaign-schema.json
A minimal test schema with 2 object types (Campaign and Budget) and no predefined tools. Used to test schema-driven CRUD tool generation.

**Usage:**
```bash
# Register this schema via API
curl -X POST http://localhost:3000/api/schema/register \
  -H "Content-Type: application/json" \
  -d @tests/schemas/test-register-payload.json
```

### test-custom-schema.json
A complete test schema with:
- 5 predefined tools (create, get, list, update, delete campaign)
- 1 resource (campaigns list)
- 1 object schema (Custom.Campaign)

Used to test custom tool registration without CRUD generation.

**Usage:**
```bash
# Register this schema via API
curl -X POST http://localhost:3000/api/schema/register \
  -H "Content-Type: application/json" \
  -d '{"schema": '$(cat tests/schemas/test-custom-schema.json)', "source": "test-custom", "sourceType": "file"}'
```

### test-register-payload.json
Pre-formatted API payload for registering test-campaign-schema.json. Contains the schema wrapped in the expected API format.

## Testing Schema Registration

1. Start the server:
   ```bash
   node server-modular.js
   ```

2. Register a test schema:
   ```bash
   curl -X POST http://localhost:3000/api/schema/register \
     -H "Content-Type: application/json" \
     -d @tests/schemas/test-register-payload.json
   ```

3. Verify the schema was loaded:
   ```bash
   curl http://localhost:3000/api/schema/current
   curl http://localhost:3000/schema/mcp/tools
   ```

4. Reset to default schema:
   ```bash
   curl -X POST http://localhost:3000/api/schema/reset
   ```

## Expected Results

- **test-campaign-schema.json**: Should generate 10 CRUD tools (5 per object type)
- **test-custom-schema.json**: Should register 5 custom tools as-is
