/**
 * MCP Tool schema definitions.
 *
 * MCP tools are described with a JSON-Schema `inputSchema`.
 * The MCP server advertises tools; the client/LLM calls them by name with `arguments`.
 *
 * We keep a small set of explicit tools (one per KRL operation) rather than a single
 * generic "call_krl" tool, because explicit tools are safer and easier for LLMs to use.
 */

const TOOL_COMMON_PROPS = {
  id: {
    type: "string",
    description: "Optional correlation id for tracing across the MCP server and pico-engine.",
  },
  eci: { type: "string", description: "ECI (channel id) to call in pico-engine." },
};

function tool({ name, description, properties, required }) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties,
      required,
    },
  };
}

// Manifold pico
const manifold_getThings = tool({
  name: "manifold_getThings",
  description: "KRL query: io.picolabs.manifold_pico/getThings",
  properties: { ...TOOL_COMMON_PROPS },
  required: ["eci"],
});

const manifold_isAChild = tool({
  name: "manifold_isAChild",
  description: "KRL query: io.picolabs.manifold_pico/isAChild",
  properties: { ...TOOL_COMMON_PROPS, picoID: { type: "string", description: "Child pico id to check." } },
  required: ["eci", "picoID"],
});

const manifold_create_thing = tool({
  name: "manifold_create_thing",
  description: "KRL event: manifold/create_thing (attrs: name)",
  properties: { ...TOOL_COMMON_PROPS, name: { type: "string", description: "Name for the new thing pico." } },
  required: ["eci", "name"],
});

const manifold_remove_thing = tool({
  name: "manifold_remove_thing",
  description: "KRL event: manifold/remove_thing (attrs: picoID)",
  properties: { ...TOOL_COMMON_PROPS, picoID: { type: "string", description: "Thing pico id to remove." } },
  required: ["eci", "picoID"],
});

const manifold_change_thing_name = tool({
  name: "manifold_change_thing_name",
  description: "KRL event: manifold/change_thing_name (attrs: picoID, changedName)",
  properties: {
    ...TOOL_COMMON_PROPS,
    picoID: { type: "string", description: "Thing pico id to rename." },
    changedName: { type: "string", description: "New name for the thing." },
  },
  required: ["eci", "picoID", "changedName"],
});

// Thing pico (safeandmine ruleset)
const safeandmine_getInformation = tool({
  name: "safeandmine_getInformation",
  description: "KRL query: io.picolabs.safeandmine/getInformation (optional arg: info)",
  properties: {
    ...TOOL_COMMON_PROPS,
    info: { type: "string", description: "Optional field name to fetch (name/email/phone/message). If omitted returns the whole map." },
  },
  required: ["eci"],
});

const safeandmine_getTags = tool({
  name: "safeandmine_getTags",
  description: "KRL query: io.picolabs.safeandmine/getTags",
  properties: { ...TOOL_COMMON_PROPS },
  required: ["eci"],
});

const safeandmine_update = tool({
  name: "safeandmine_update",
  description: "KRL event: safeandmine/update (attrs: name,email,phone,message,shareName,shareEmail,sharePhone)",
  properties: {
    ...TOOL_COMMON_PROPS,
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    message: { type: "string" },
    shareName: { type: "boolean" },
    shareEmail: { type: "boolean" },
    sharePhone: { type: "boolean" },
  },
  required: ["eci"],
});

const safeandmine_delete = tool({
  name: "safeandmine_delete",
  description: "KRL event: safeandmine/delete (optional attr: toDelete). If omitted clears all stored info.",
  properties: { ...TOOL_COMMON_PROPS, toDelete: { type: "string" } },
  required: ["eci"],
});

const safeandmine_newtag = tool({
  name: "safeandmine_newtag",
  description: "KRL event: safeandmine/new_tag (attrs: tagID, domain)",
  properties: {
    ...TOOL_COMMON_PROPS,
    tagID: { type: "string", description: "Tag identifier." },
    domain: { type: "string", description: "Tag domain/type (e.g., sqtg)." },
  },
  required: ["eci", "tagID", "domain"],
});

module.exports = {
  tools: [
    manifold_getThings,
    manifold_isAChild,
    manifold_create_thing,
    manifold_remove_thing,
    manifold_change_thing_name,
    safeandmine_getInformation,
    safeandmine_getTags,
    safeandmine_update,
    safeandmine_delete,
    safeandmine_newtag,
  ],
};

