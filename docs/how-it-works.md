# How It Works

This system connects a natural language interface to a distributed event-driven backend. At a high level, a user types a message, a language model interprets it, and the system translates that intent into events executed by the pico engine.

The flow is designed to separate responsibilities cleanly: the frontend handles interaction, the backend manages communication, MCP structures tool usage, and picos execute logic.

## End-to-End Flow

For an example, we will be using the request to "Create a backpack" to demonstrate how it travels through every layer of the system.

### 1. User Input (Chat UI)

The process begins with the file `ChatComponent.jsx`. A user of the conversational interface types in the request to "Create a backpack". The message is sent to the api/chat endpoint within the `api-proxy.js` file.

### 2. MCP Client

The `api-proxy.js` file serves as the headquarters for bridging the server and the MCPClient. It receives the message and passes it to the MCPClient to be processed.

### 3. Transport Layer (Express + Socket.io)

The message is sent to the backend using WebSockets. This allows for real time, bidirectional communication between the UI and the server.

### 4. Tool Invocation (MCP Server)

If the LLM decides to call a tool

- The MCP client sends the request to the MCP server (via stdio)
- The MCP server validates and routs the request to the appropriate operation.

### 6. State & Logic (Pico Engine)

The Manifold API and the Pico Engine

- Recieves the event
- Executes the relevent ruleset (KRL)
- Updates state

### 7. Response Propagation

The result flows back up the stack:

- Pico Engine -> MCP Server -> MCP client -> Backend -> Frontend
- The user sees a response in natural language

How the MCP client builds the Bedrock request with tool schemas

How Claude decides to call manifold_create_thing

How the MCP server (stdio transport) receives and dispatches it

How krl-operation.js translates it to a pico engine event

How the KRL ruleset handles the event

How the result flows back up
