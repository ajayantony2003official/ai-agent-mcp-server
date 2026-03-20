# AI Agent Server

This folder is the Gemini brain layer only.

It does not execute CRM tools directly.
It only:
- receives chat requests
- builds the Gemini prompt
- sends function definitions to Gemini
- enriches arguments with runtime context
- calls the external MCP server over HTTP

Structure:
- `clients/`
  MCP HTTP client
- `llm/`
  Gemini-facing function definitions and tool registry
- `routes/`
  HTTP routes for the AI agent
- `services/`
  chat/session logic and MCP bridge logic
- `utils/`
  prompt helpers, filter inference, fallback helpers

Important files:
- `server.js`
  starts the AI agent server
- `clients/mcpClient.js`
  calls `http://localhost:4000/execute`
- `services/mcpExecutionService.js`
  prepares arguments and forwards tool calls to MCP
- `llm/toolRegistry.js`
  Gemini function declaration registry
