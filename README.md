# README

This is a repository for the MCPforEXP project. The project aims to create a conversational interface for Manifold.

## Project Structure

The project is structured to clearly separate concerns and support scalability and testing. Source code lives under src/, with backend logic divided between server functionality and LLM/MCP integration, and the UI isolated in its own directory. Tests mirror the source structure under test/, making it easy to locate and maintain test coverage alongside corresponding components. Supporting scripts are kept in scripts/ to keep automation and tooling separate from application logic. This layout was chosen to improve readability, encourage modular development, and make the system easier to extend as the MCP and LLM integrations evolve.

```text
├── scripts/
├── src/
│   ├── backend/
│   │   ├── mcp-server/
│   │   ├── utility/
│   │   └── llm/
│   ├── mcp-client/
│   └── frontend/
├── test/
│   ├── backend/
│   │   ├── server/
│   │   ├── llm/
│   │   └── mcp/
│   └── frontend/
```

## Usage

This project comes with convenient npm scripts to manage setup, teardown, and tests.

### Install Dependencies

Make sure you’ve installed project dependencies:

```bash
npm install
```

### Setup

Run the full project setup. This will install the manifold ruleset to the pico.
After running the setup script you can then start the pico engine at will.

```bash
npm run setup
pico-engine
```

The _npm run setup command_ runs the scripts/setup.sh script.

### Teardown

Stop servers and clean up any temporary processes or files:

```bash
npm run teardown
```

This runs the scripts/teardown.sh script.

### Running Tests

To run the Jest test suite:

```bash
npm test
```

Or equivalently:

```bash
npm run test
```

## Uniform JSON for MCP ↔ KRL (events + queries)

This repo includes a small adapter that normalizes **all** pico-engine calls (KRL queries + events) into a single JSON envelope.

### Request envelope

Use this shape for every operation:

```json
{
  "id": "optional-correlation-id",
  "target": { "eci": "ECI_HERE" },
  "op": {
    "kind": "query",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings"
  },
  "args": {}
}
```

- **Queries** use `op.kind="query"` with `op.rid` + `op.name`
- **Events** use `op.kind="event"` with `op.domain` + `op.type`
- **Args** are always an object (query args or event attrs)

### Response envelope

Success:

```json
{
  "id": "optional-correlation-id",
  "ok": true,
  "data": {},
  "meta": {
    "kind": "query",
    "eci": "ECI_HERE",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings",
    "httpStatus": 200
  }
}
```

Error:

```json
{
  "id": "optional-correlation-id",
  "ok": false,
  "error": {
    "code": "HTTP_ERROR",
    "message": "Upstream returned HTTP 500",
    "details": {}
  },
  "meta": {
    "kind": "query",
    "eci": "ECI_HERE",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings",
    "httpStatus": 500
  }
}
```

### Implemented operations (MCP-friendly)

These helpers live in `src/backend/krl-operation.js` and all return the envelope above:

- **Manifold pico**
  - Query: `manifold_getThings()`
  - Event: `manifold_create_thing(thingName)`
  - Event: `manifold_remove_thing(thingName)`
  - Event: `manifold_change_thing_name(thingName, changedName)` (note: KRL expects `changedName`)
- **Thing pico (safeandmine + journal ruleset)**
  - Query: `scanTag(tagId, domain)`
  - Query: `getNote(thingName, title)`
  - Event: `updateOwnerInfo(thingName, ownerInfo: { name,email,phone,message, shareName,shareEmail,sharePhone })`
  - Event: `safeandmine_newtag(thingName, tagID, domain)`
  - Event: `addNote(thingName, title, content)`

## MCP server (next step)

### What MCP “tool schema” means

In MCP, a **tool** is described by:

- **name**: string identifier (e.g. `manifold_getThings`)
- **description**: short human/LLM guidance
- **inputSchema**: **JSON Schema** describing the tool’s `arguments`

The MCP client sends: `{ name: "toolName", arguments: { ... } }`

### This repo’s MCP server scaffolding

- **Tool schemas**: `src/mcp/tools.js`
- **Server (stdio)**: `src/mcp/server.js` (registers tools and returns the uniform envelope as JSON text)

### Install + run

Install dependencies (needs network):

```bash
npm install
```

Run the MCP server:

```bash
npm run mcp:server
```

Once this is running, an MCP client (like a desktop app / agent runner) can connect over stdio and call tools like `manifold_getThings` with `{ "eci": "..." }`.

## LLM Integration

To get the mcp-client command interface working, make sure to install the AWS SDK dependency:

```bash
npm install @aws-sdk/client-bedrock-runtime
```

Then to get the interface up and running:

```bash
npm run client
```

## Running the Frontend

To test or use our frontend component for interacting with the MCP client/LLM, you will need two terminals open and running.

1. Run `npm run dev` to open vite
2. Run `npm run proxy` to connect to the mcp server

Alternatively, open `http://18.217.240.202:3005/` in your browser to see the chatbot or `http://18.217.240.202:3000/` to see the associated pico-engine.

NOTE: As it's currently configured, no matter which way the chatbot is opened, it will connect to the pico-engine instance running on the EC2 server. Any interactions you make with the pico-engine will be recorded and show up for any othe user. Multi-tenancy will be the next step.
