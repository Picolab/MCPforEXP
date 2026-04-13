# How It Works

This system connects a natural language interface to a distributed event-driven backend. At a high level, a user types a message, a language model interprets it, and the system translates that intent into events executed by the pico engine.

The flow is designed to separate responsibilities cleanly: the frontend handles interaction, the backend manages communication, MCP structures tool usage, and picos execute logic.

## End-to-End Flow

Here's what happens when a user sends a message:

1. **User Input (Chat UI)** The user enters a message in the chat interface (e.g., "Create a new pico and register it").
2. **Transport Layer (Express + Socket.io)**
   The message is sent to the backend using WebSockets. This allows for real time, bidirectional communication between the UI and the server.
3. **Tool Invocation (MCP Server)**
   If the LLM decides to call a tool

- The MCP client sends the request to the MCP server (via stdio)
- The MCP server validates and routs the request to the appropriate operation.

6. **State & Logic (Pico Engine)**
   The Manifold API and the Pico Engine

- Recieves the event
- Executes the relevent ruleset (KRL)
- Updates state

7. **Response Propagation**
   The result flows back up the stack:

- Pico Engine -> MCP Server -> MCP client -> Backend -> Frontend
- The user sees a response in natural language

## Key Mechanisms

### Tool Calling via MCP

Instead of returning only text, the LLM can decide to call a tool. For example:

- User: "Create a book"
- LLM: Calls manifold_create_thing with structured arguments.

This makes the system reliable and deterministic-actions are not inferred from text but are explicitly invoked.

## Event-Based Execution

The pico engine operates on events:

- Every action becomes an event
- Events are sent to a pico using its ECI (Event Channel Identifier)
- Rulesets listen for events and react accordingly

This model enables:

- Decoupled components
- Asynchronous workflows
- Scalable system design

## Example Walkthrough

**User Input:**
“List all my things"

**Step-by-step:**

1. User sends message via Chat UI
2. Backend forwards message to MCP client
3. LLM determines this maps to a manifold_getThings tool
4. MCP client sends tool call to MCP server
5. Operation sends event to Manifold API using ECI
6. Pico engine retrieves pico list
7. Result is returned up the stack
8. LLM formats the result into a readable response
9. User sees the list in the UI

## Where to Look Next

- src/backend/mcp-server/ – Tool definitions and routing
- src/mcp-client/ – LLM interaction logic
- Manifold-api/ – KRL rulesets and pico logic
- prompts/ – Prompt templates used by the LLM
