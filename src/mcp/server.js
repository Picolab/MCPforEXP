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

const {
  getThings,
  manifold_isAChild,
  createThing,
  deleteThing,
  manifold_change_thing_name,
  safeandmine_getInformation,
  safeandmine_getTags,
  safeandmine_update,
  safeandmine_delete,
  addTag,
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

  const base = { eci: z.string(), id: z.string().optional() };

  server.tool(
    "getThings",
    "List all digital things managed by Manifold. No arguments required.",
    { id: z.string().optional() },
    toolHandler(({ id }) => getThings(id)),
  );

  server.tool(
    "manifold_isAChild",
    "KRL query: io.picolabs.manifold_pico/isAChild",
    { ...base, picoID: z.string() },
    toolHandler(({ eci, picoID, id }) => manifold_isAChild(eci, picoID, id)),
  );

  server.tool(
    "createThing",
    "Create a new digital thing Pico. Provide a descriptive name.",
    {
      name: z.string().describe("Descriptive name (e.g. 'Backpack')"),
      id: z.string().optional(),
    },
    toolHandler(({ name, id }) => createThing(name, id)),
  );

  server.tool(
    "deleteThing",
    "Delete a thing Pico by name. This will remove the pico and all its data irreversibly.",
    { thingName: z.string(), id: z.string().optional() },
    toolHandler(({ thingName, id }) => deleteThing(thingName, id)),
  );

  server.tool(
    "manifold_change_thing_name",
    "KRL event: manifold/change_thing_name (attrs: picoID, changedName)",
    { ...base, picoID: z.string(), changedName: z.string() },
    toolHandler(({ eci, picoID, changedName, id }) =>
      manifold_change_thing_name(eci, picoID, changedName, id),
    ),
  );

  server.tool(
    "safeandmine_getInformation",
    "KRL query: io.picolabs.safeandmine/getInformation (optional arg: info)",
    { ...base, info: z.string().optional() },
    toolHandler(({ eci, info, id }) =>
      safeandmine_getInformation(eci, info, id),
    ),
  );

  server.tool(
    "safeandmine_getTags",
    "KRL query: io.picolabs.safeandmine/getTags",
    { ...base },
    toolHandler(({ eci, id }) => safeandmine_getTags(eci, id)),
  );

  server.tool(
    "safeandmine_update",
    "KRL event: safeandmine/update (attrs: name,email,phone,message,shareName,shareEmail,sharePhone)",
    {
      ...base,
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      message: z.string().optional(),
      shareName: z.boolean().optional(),
      shareEmail: z.boolean().optional(),
      sharePhone: z.boolean().optional(),
    },
    toolHandler(
      ({
        eci,
        id,
        name,
        email,
        phone,
        message,
        shareName,
        shareEmail,
        sharePhone,
      }) =>
        safeandmine_update(
          eci,
          { name, email, phone, message, shareName, shareEmail, sharePhone },
          id,
        ),
    ),
  );

  server.tool(
    "safeandmine_delete",
    "KRL event: safeandmine/delete (optional attr: toDelete). If omitted clears all stored info.",
    { ...base, toDelete: z.string().optional() },
    toolHandler(({ eci, toDelete, id }) =>
      safeandmine_delete(eci, toDelete, id),
    ),
  );

  server.tool(
    "addTag",
    "Assign a physical SquareTag to a named Pico.",
    {
      thingName: z.string().describe("The name of the Pico to tag"),
      tagID: z.string().describe("The alphanumeric tag ID"),
      domain: z.string().default("sqtg"),
    },
    toolHandler(({ thingName, tagID, domain, id }) =>
      addTag(thingName, tagID, domain, id),
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
