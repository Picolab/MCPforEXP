/**
 * MCP Tool schema definitions.
 *
 * MCP tools are described with JSON Schema for both inputs and outputs.
 * The MCP server advertises tools; the client/LLM calls them by name with `arguments`.
 *
 * We keep a small set of explicit tools (one per KRL operation) rather than a single
 * generic "call_krl" tool, because explicit tools are safer and easier for LLMs to use.
 *
 * All tools return the uniform envelope: { id, ok, data?, error?, meta }
 */

const TOOL_COMMON_PROPS = {
  id: {
    type: "string",
    description:
      "Optional correlation id for tracing across the MCP server and pico-engine.",
  },
  eci: {
    type: "string",
    description: "ECI (channel id) to call in pico-engine.",
  },
};

// Uniform output schema for all tools (the envelope from krl-json.js)
const OUTPUT_SCHEMA = {
  type: "object",
  required: ["id", "ok", "meta"],
  properties: {
    id: {
      type: "string",
      description: "Correlation id (auto-generated if not provided in request)",
    },
    ok: {
      type: "boolean",
      description: "Whether the operation succeeded",
    },
    data: {
      description:
        "Response data (present when ok=true). Structure varies by tool.",
    },
    error: {
      type: "object",
      description: "Error details (present when ok=false)",
      properties: {
        code: {
          type: "string",
          enum: ["HTTP_ERROR", "NETWORK_ERROR", "INVALID_REQUEST"],
          description: "Error category",
        },
        message: {
          type: "string",
          description: "Human-readable error message",
        },
        details: { description: "Additional error context (structure varies)" },
      },
      required: ["code", "message"],
    },
    meta: {
      type: "object",
      description: "Operation metadata",
      required: ["kind", "eci", "httpStatus"],
      properties: {
        kind: {
          type: "string",
          enum: ["query", "event"],
          description: "Operation type",
        },
        eci: { type: "string", description: "ECI used for the operation" },
        httpStatus: {
          type: "number",
          description: "HTTP status code from pico-engine",
        },
        // Query-specific meta
        rid: { type: "string", description: "Ruleset ID (for queries)" },
        name: {
          type: "string",
          description: "Query function name (for queries)",
        },
        // Event-specific meta
        domain: { type: "string", description: "Event domain (for events)" },
        type: { type: "string", description: "Event type (for events)" },
      },
    },
  },
};

function tool({ name, description, properties, required, outputDescription }) {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties,
      required,
    },
    outputSchema: {
      ...OUTPUT_SCHEMA,
      description: outputDescription || `Standard envelope. ${description}`,
    },
  };
}

// Manifold pico
const getThings = tool({
  name: "getThings",
  description:
    "Get a list of all things (child picos) under the manifold pico.",
  properties: { ...TOOL_COMMON_PROPS },
  required: [],
  outputDescription:
    "Returns map of thing picoIDs to thing objects (name, subID, picoID, color, etc.)",
});

const manifold_isAChild = tool({
  name: "manifold_isAChild",
  description: "KRL query: io.picolabs.manifold_pico/isAChild",
  properties: {
    ...TOOL_COMMON_PROPS,
    picoID: { type: "string", description: "Child pico id to check." },
  },
  required: ["eci", "picoID"],
  outputDescription:
    "Returns boolean indicating if the given picoID is a child of the manifold pico",
});

const createThing = tool({
  name: "createThing",
  description: "Create a new digital thing Pico. Provide a descriptive name.",
  properties: {
    ...TOOL_COMMON_PROPS,
    name: { type: "string", description: "Name for the new thing pico." },
  },
  required: ["name"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const manifold_remove_thing = tool({
  name: "removeThing",
  description:
    "Delete a thing Pico by name. This will remove the pico and all its data irreversibly.",
  properties: {
    ...TOOL_COMMON_PROPS,
    thingName: { type: "string", description: "Thing pico name to remove." },
  },
  required: ["thingName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const manifold_change_thing_name = tool({
  name: "manifold_change_thing_name",
  description:
    "KRL event: manifold/change_thing_name (attrs: picoID, changedName)",
  properties: {
    ...TOOL_COMMON_PROPS,
    picoID: { type: "string", description: "Thing pico id to rename." },
    changedName: { type: "string", description: "New name for the thing." },
  },
  required: ["eci", "picoID", "changedName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

// Thing pico (safeandmine ruleset)
const safeandmine_getInformation = tool({
  name: "safeandmine_getInformation",
  description:
    "KRL query: io.picolabs.safeandmine/getInformation (optional arg: info)",
  properties: {
    ...TOOL_COMMON_PROPS,
    info: {
      type: "string",
      description:
        "Optional field name to fetch (name/email/phone/message). If omitted returns the whole map.",
    },
  },
  required: ["eci"],
  outputDescription:
    "Returns contact info map (name, email, phone, message) or single field value if info param provided",
});

const safeandmine_getTags = tool({
  name: "safeandmine_getTags",
  description: "KRL query: io.picolabs.safeandmine/getTags",
  properties: { ...TOOL_COMMON_PROPS },
  required: ["eci"],
  outputDescription:
    "Returns map of tag domains to tag IDs registered on this thing pico",
});

const safeandmine_update = tool({
  name: "safeandmine_update",
  description:
    "KRL event: safeandmine/update (attrs: name,email,phone,message,shareName,shareEmail,sharePhone)",
  properties: {
    ...TOOL_COMMON_PROPS,
    name: { type: "string", description: "Contact name" },
    email: { type: "string", description: "Contact email" },
    phone: { type: "string", description: "Contact phone" },
    message: { type: "string", description: "Contact message" },
    shareName: { type: "boolean", description: "Whether to share name" },
    shareEmail: { type: "boolean", description: "Whether to share email" },
    sharePhone: { type: "boolean", description: "Whether to share phone" },
  },
  required: ["eci"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const safeandmine_delete = tool({
  name: "safeandmine_delete",
  description:
    "KRL event: safeandmine/delete (optional attr: toDelete). If omitted clears all stored info.",
  properties: {
    ...TOOL_COMMON_PROPS,
    toDelete: {
      type: "string",
      description:
        "Field name to delete (name/email/phone/message). Omit to clear all.",
    },
  },
  required: ["eci"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const safeandmine_newtag = tool({
  name: "addTag",
  description:
    "Add a new tag to this thing pico, which registers it in the tag registry and makes it discoverable by that tag.",
  properties: {
    ...TOOL_COMMON_PROPS,
    tagID: { type: "string", description: "Tag identifier." },
    domain: { type: "string", description: "Tag domain/type (e.g., sqtg)." },
  },
  required: ["thingName", "tagID", "domain"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

// Utility tools
const addTags = tool({
  name: "addTags",
  description:
    "Installs safeandmine ruleset on a thing pico if not already installed",
  properties: { ...TOOL_COMMON_PROPS },
  required: ["eci"],
  outputDescription:
    "Returns undefined (void operation), check meta.httpStatus for success",
});

const childHasRuleset = tool({
  name: "childHasRuleset",
  description: "Check if a ruleset (RID) is installed on a child pico",
  properties: {
    ...TOOL_COMMON_PROPS,
    rid: {
      type: "string",
      description: "Ruleset ID to check (e.g., io.picolabs.safeandmine)",
    },
  },
  required: ["eci", "rid"],
  outputDescription:
    "Returns boolean indicating if the ruleset is installed (note: this is a direct API call, not via uniform envelope)",
});

const getRootECI = tool({
  name: "getRootECI",
  description:
    "Get the root pico ECI (UI pico). Hierarchy: Root Pico → Tag Registry & Owner Picos → Owner → Manifold Pico → Thing Picos.",
  properties: {},
  required: [],
  outputDescription:
    "Returns { rootEci: string } — the ECI of the root pico (pico-engine UI pico).",
});

const installOwner = tool({
  name: "installOwner",
  description:
    "Install the manifold_owner ruleset on the root pico (requires root ECI)",
  properties: { ...TOOL_COMMON_PROPS },
  required: ["eci"],
  outputDescription:
    "Returns undefined (void operation), check console/logs for success",
});

const initializeManifold = tool({
  name: "initializeManifold",
  description:
    "Full bootstrap: install owner ruleset, create manifold pico, return manifold ECI (no args needed, uses root ECI)",
  properties: {},
  required: [],
  outputDescription:
    "Returns the manifold pico ECI as a string (not wrapped in uniform envelope)",
});

const installRuleset = tool({
  name: "installRuleset",
  description: "Install a KRL ruleset on a pico via file:// URL",
  properties: {
    ...TOOL_COMMON_PROPS,
    filePath: {
      type: "string",
      description: "File URL (e.g., file:///path/to/ruleset.krl)",
    },
  },
  required: ["eci", "filePath"],
  outputDescription:
    "Returns undefined (void operation), check console/logs for success",
});

module.exports = {
  tools: [
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
    getRootECI,
    addTags,
    childHasRuleset,
    installOwner,
    initializeManifold,
    installRuleset,
  ],
};
