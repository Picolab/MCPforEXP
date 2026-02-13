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
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  installOwner,
  getECIByTag,
  getChildEciByName,
  installRuleset,
} = require("../backend/utility.js");
const {
  getThings,
  manifold_isAChild,
  createThing,
  manifold_remove_thing,
  manifold_change_thing_name,
  safeandmine_getInformation,
  safeandmine_getTags,
  safeandmine_update,
  safeandmine_delete,
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
    "manifold_remove_thing",
    "KRL event: manifold/remove_thing (attrs: thingName)",
    { thingName: z.string(), id: z.string().optional() },
    toolHandler(({ thingName, id }) => manifold_remove_thing(thingName, id)),
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

  // Additional utility tools
  server.tool(
    "getRootECI",
    "Get the root pico ECI (UI pico). Hierarchy: Root Pico → Tag Registry & Owner Picos → Owner → Manifold Pico → Thing Picos.",
    {},
    toolHandler(async () => {
      const eci = await getRootECI();
      return { rootEci: eci };
    }),
  );

  server.tool(
    "getChildEciByName",
    "Find the ECI of a child pico by name. Queries a parent pico to find a child pico with a specific name.",
    {
      parentEci: z.string().describe("Parent pico ECI"),
      childName: z.string().describe("Name of the child pico to find"),
    },
    toolHandler(async ({ parentEci, childName }) => {
      const eci = await getChildEciByName(parentEci, childName);
      return { eci: eci || null };
    }),
  );

  server.tool(
    "getInitializationECI",
    "Get the initialization channel ECI from an owner pico. This channel has proper permissions for querying manifold_owner.",
    { ownerEci: z.string().describe("Owner pico ECI") },
    toolHandler(async ({ ownerEci }) => {
      const eci = await getInitializationECI(ownerEci);
      return { eci: eci || null };
    }),
  );

  server.tool(
    "getManifoldECI",
    "Get the manifold pico channel ECI (channel tagged 'manifold') from the owner pico. Requires owner initialization ECI.",
    {
      ownerInitializationEci: z
        .string()
        .describe("Owner pico initialization ECI (from getInitializationECI)"),
    },
    toolHandler(async ({ ownerInitializationEci }) => {
      const eci = await getManifoldECI(ownerInitializationEci);
      return { eci: eci || null };
    }),
  );

  server.tool(
    "getECIByTag",
    "Get a channel ECI by tag from a pico. Searches all channels on the pico for one with the specified tag.",
    {
      eci: z.string().describe("Pico ECI to search"),
      tag: z
        .string()
        .describe("Tag to search for (e.g., 'manifold', 'initialization')"),
    },
    toolHandler(async ({ eci, tag }) => {
      const channelEci = await getECIByTag(eci, tag);
      return { eci: channelEci || null };
    }),
  );

  server.tool(
    "installOwner",
    "Install the manifold_owner ruleset on the root pico (requires root ECI)",
    { ...base },
    toolHandler(async ({ eci }) => {
      try {
        await installOwner(eci);
        return {
          success: true,
          message: "manifold_owner ruleset installation initiated",
        };
      } catch (error) {
        return {
          success: false,
          error: error.message || "Failed to install ruleset",
        };
      }
    }),
  );

  server.tool(
    "installRuleset",
    "Install a KRL ruleset on a pico via file:// URL",
    {
      ...base,
      filePath: z
        .string()
        .describe("File URL (e.g., file:///path/to/ruleset.krl)"),
    },
    toolHandler(async ({ eci, filePath }) => {
      try {
        await installRuleset(eci, filePath);
        return { success: true, message: "Ruleset installation initiated" };
      } catch (error) {
        return {
          success: false,
          error: error.message || "Failed to install ruleset",
        };
      }
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("MCP server failed:", e);
  process.exit(1);
});
