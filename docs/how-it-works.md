# End-to-End Walkthrough

This document will outline the flow of how a single user request travels through every layer of the system. For this example, we will be using the request of "Create a backpack".

## Frontend: Manny Assistant

The process begins with the file `ChatComponent.jsx`. A user of the conversational interface types in the request to "Create a backpack". The message is sent to the api/chat endpoint within the `api-proxy.js` file.

## MCP Client

The `api-proxy.js` file serves as the headquarters for bridging the server and the MCPClient. It receives the message, which it then passes to the MCPClient to be processed.

The MCPClient retrieves and formats the history of the

How the MCP client builds the Bedrock request with tool schemas

How Claude decides to call manifold_create_thing

How the MCP server (stdio transport) receives and dispatches it

How krl-operation.js translates it to a pico engine event

How the KRL ruleset handles the event

How the result flows back up
