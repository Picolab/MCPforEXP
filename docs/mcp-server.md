# MCP server (next step)

## What MCP “tool schema” means

In MCP, a **tool** is described by:

- **name**: string identifier (e.g. `manifold_getThings`)
- **description**: short human/LLM guidance
- **inputSchema**: **JSON Schema** describing the tool’s `arguments`

The MCP client sends: `{ name: "toolName", arguments: { ... } }`

## This repo’s MCP server scaffolding

- **Tool schemas**: `src/mcp/tools.js`
- **Server (stdio)**: `src/mcp/server.js` (registers tools and returns the uniform envelope as JSON text)

## Install + run

Install dependencies (needs network):

```bash
npm install
```

Run the MCP server:

```bash
npm run mcp:server
```

Once this is running, an MCP client (like a desktop app / agent runner) can connect over stdio and call tools like `manifold_getThings` with `{ "eci": "..." }`.
