const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });
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
  manifold_getThingSkills,
  manifold_installSkill,
  safeandmine_newtag,
  scanTag,
  updateOwnerInfo,
  addNote,
  getNote,
  manifold_getCommunities,
  manifold_create_community,
  manifold_add_thing_to_community,
  manifold_get_community_things,
  manifold_get_community_description,
  manifold_remove_community
} = require("../krl-operation.js");

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
    "manifold_getThingSkills",
    "Derive which Skills are installed on a Thing by checking installed KRL rulesets.",
    {
      thingName: z
        .string()
        .describe("The name of the Thing pico to inspect for installed Skills"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, id }) => manifold_getThingSkills(thingName, id)),
  );

  server.tool(
    "manifold_installSkill",
    "Install a logical Skill on a Thing by installing its backing KRL ruleset (e.g., journal, safeandmine).",
    {
      thingName: z
        .string()
        .describe("The name of the Thing pico to install the Skill on"),
      skillName: z
        .enum(["journal", "safeandmine"])
        .describe("The logical Skill name to install (journal or safeandmine)"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, skillName, id }) =>
      manifold_installSkill(thingName, skillName, id),
    ),
  );

  server.tool(
    "safeandmine_newtag",
    "Assign a physical tag to a named Pico.",
    {
      thingName: z.string().describe("The name of the Pico to tag"),
      tagID: z.string().describe("The alphanumeric tag ID"),
      domain: z.string().describe("The domain of the tag (e.g. 'sqtg')"),
    },
    toolHandler(({ thingName, tagID, domain, id }) =>
      safeandmine_newtag(thingName, tagID, domain, id),
    ),
  );

  server.tool(
    "scanTag",
    "Scan a tag by its ID and domain to see if it's registered to any Pico.",
    {
      tagID: z.string().describe("The alphanumeric tag ID"),
      domain: z.string().describe("The domain of the tag (e.g. 'sqtg')"),
      id: z.string().optional(),
    },
    toolHandler(({ tagID, domain, id }) => scanTag(tagID, domain, id)),
  );

  server.tool(
    "updateOwnerInfo",
    "Update the owner information for a thing pico.",
    {
      thingName: z.string().describe("The name of the thing to update"),
      ownerInfo: z
        .object({
          name: z.string().describe("Owner's name").optional(),
          email: z.string().describe("Owner's email").optional(),
          phone: z.string().describe("Owner's phone number").optional(),
          message: z.string().describe("A message from the owner").optional(),
          shareName: z
            .boolean()
            .describe("Whether to share the owner's name")
            .optional(),
          shareEmail: z
            .boolean()
            .describe("Whether to share the owner's email")
            .optional(),
          sharePhone: z
            .boolean()
            .describe("Whether to share the owner's phone")
            .optional(),
        })
        .describe(
          "Object containing info to update. Null fields will signal that the field's previously stored info should be used.",
        ),
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
      title: z
        .string()
        .describe(
          "The title of the note to retrieve. If given an empty string, all journal entries will be returned (convenient for searching).",
        ),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, title, id }) => getNote(thingName, title, id)),
  );

  server.tool(
    "manifold_getCommunities",
    "List all digital communites managed by Manifold. No arguments required.",
    { id: z.string().optional() },
    toolHandler(({ id }) => manifold_getCommunities(id)),
  );

  server.tool(
    "manifold_create_community",
    "Create a new digital community Pico. Provide a descriptive name and a separate description.",
    {
      communityName: z.string().describe("Descriptive name (e.g. 'School Items')"),
      description: z.string().describe("Description for the new community (e.g. 'supplies and wearables intended to be used at school.'"),
      id: z.string().optional(),
    },
    toolHandler(({ communityName, description, id }) => manifold_create_community(communityName, description, id)),
  );

  server.tool(
    "manifold_add_thing_to_community",
    "Add a thing Pico to a community Pico of your choice. Please provide the name of both the thing Pico and community Pico in question.",
    {
      thingName: z.string().describe("The name of the thing Pico that will be added to the community"),
      communityName: z.string().describe("The name of the community Pico"),
      id: z.string().optional(),
    },
    toolHandler(({ thingName, communityName, id }) => manifold_add_thing_to_community(thingName, communityName, id)),
  );

  server.tool(
    "manifold_get_community_things",
    "Get a list of all the thing Picos attached a community Pico. Please provide the name of the community Pico in question.",
    {
      communityName: z.string().describe("The name of the community Pico"),
      id: z.string().optional(),
    },
    toolHandler(({ communityName, id }) => manifold_get_community_things(communityName, id)),
  );

  server.tool(
    "manifold_get_community_description",
    "Get a list of the description attached to a community Pico. Please provide the name of the community Pico in question.",
    {
      communityName: z.string().describe("The name of the community Pico"),
      id: z.string().optional(),
    },
    toolHandler(({ communityName, id }) => manifold_get_community_description(communityName, id)),
  );

  server.tool(
    "manifold_remove_community",
    "Delete an existing digital community Pico. Please provide the name of the community Pico in question.",
    {
      communityName: z.string().describe("The name of the community Pico"),
      id: z.string().optional(),
    },
    toolHandler(({ communityName, id }) => manifold_remove_community(communityName, id))
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("MCP server failed:", e);
  process.exit(1);
});
