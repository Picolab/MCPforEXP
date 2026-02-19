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

const { tools } = require("./tools.js");

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
  scanTag,
  updateOwnerInfo,
  addNote,
  getNote,
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

  server.tool(
    "scanTag",
    "Scan a SquareTag by its ID and domain to see if it's registered to any Pico.",
    {
      tagID: z.string().describe("The alphanumeric tag ID"),
      domain: z.string().default("sqtg"),
      id: z.string().optional(),
    },
    toolHandler(({ tagID, domain, id }) => scanTag(tagID, domain, id)),
  );

  server.tool(
    "updateOwnerInfo",
    "Update the owner information for a thing pico.",
    {
      thingName: z.string().describe("The name of the thing to update"),
      ownerInfo: z.object({
        name: z.string().describe("Owner's name"),
        email: z.string().describe("Owner's email"),
        phone: z.string().describe("Owner's phone number"),
        message: z.string().describe("A message from the owner"),
        shareName: z.boolean().describe("Whether to share the owner's name"),
        shareEmail: z.boolean().describe("Whether to share the owner's email"),
        sharePhone: z.boolean().describe("Whether to share the owner's phone"),
      }),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, ownerInfo, id }) =>
      updateOwnerInfo(thingName, ownerInfo, id),
    ),
  );

  server.tool(
    "addNote",
    "Add a note to a thing pico's journal.",
    {
      thingName: z.string().describe("The name of the thing to add a note to"),
      title: z.string().describe("The title of the note"),
      content: z.string().describe("The content of the note"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, title, content, id }) =>
      addNote(thingName, title, content, id),
    ),
  );

  server.tool(
    "getNote",
    "Get a note from a thing pico's journal.",
    {
      thingName: z
        .string()
        .describe("The name of the thing to get a note from"),
      title: z.string().describe("The title of the note to retrieve"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, title, id }) => getNote(thingName, title, id)),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("MCP server failed:", e);
  process.exit(1);
});
