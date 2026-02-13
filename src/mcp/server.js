/**
 * Minimal MCP server over stdio (the most common way to run MCP locally).
 *
 * What MCP expects:
 * - The server advertises "tools" with JSON Schema `inputSchema`
 * - The client calls tools by name with `arguments`
 * - The server returns a result with `content` (usually text/json)
 *
 * This server delegates all KRL work to `src/backend/api-wrapper.js`,
 * which already returns a uniform envelope: { id, ok, data, error?, meta }.
 */

const { tools } = require("./tools");

// MCP SDK (installed via npm): @modelcontextprotocol/sdk
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// Utility functions are no longer exposed to MCP users
const {
  manifold_getThings,
  manifold_create_thing,
  manifold_remove_thing,
  manifold_change_thing_name,
  safeandmine_newtag,
} = require("../backend/krl-operation.js");

function asJsonContent(obj) {
  return [{ type: "text", text: JSON.stringify(obj, null, 2) }];
}

function toolHandler(fn) {
  return async (args) => {
    const result = await fn(args);
    return { content: asJsonContent(result) };
  };
}

async function main() {
  const server = new McpServer({
    name: "mcpforexp-manifold",
    version: "0.1.0",
  });

  // NOTE: The Node MCP SDK expects argument schemas as Zod, which Inspector can render.
  // We still keep `src/mcp/tools.js` for human-readable JSON schema + docs, but register Zod here.

  server.tool(
    "manifold_getThings",
    "List all digital things managed by Manifold. No arguments required.",
    { id: z.string().optional() },
    toolHandler(({ id }) => manifold_getThings(id)),
  );

  server.tool(
    "manifold_create_thing",
    "Create a new digital thing Pico. Provide a descriptive name.",
    {
      name: z.string().describe("Descriptive name (e.g. 'Backpack')"),
      id: z.string().optional(),
    },
    toolHandler(({ name, id }) => manifold_create_thing(name, id)),
  );

  server.tool(
    "manifold_remove_thing",
    "Remove a thing pico from Manifold by its name.",
    {
      thingName: z.string().describe("The name of the thing to remove"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, id }) => manifold_remove_thing(thingName, id)),
  );

  server.tool(
    "manifold_change_thing_name",
    "Rename a thing pico. Use the thing's current name and the new name.",
    {
      thingName: z.string().describe("The current name of the thing to rename"),
      changedName: z.string().describe("The new name for the thing"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, changedName, id }) =>
      manifold_change_thing_name(thingName, changedName, id),
    ),
  );

  server.tool(
    "safeandmine_newtag",
    "Assign a physical SquareTag to a named Pico.",
    {
      thingName: z.string().describe("The name of the Pico to tag"),
      tagID: z.string().describe("The alphanumeric tag ID"),
      domain: z.string().default("sqtg"),
    },
    toolHandler(({ thingName, tagID, domain, id }) =>
      safeandmine_newtag(thingName, tagID, domain, id),
    ),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("MCP server failed:", e);
  process.exit(1);
});
