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
const manifold_getThings = tool({
  name: "manifold_getThings",
  description:
    "List all digital things managed by Manifold. No arguments required.",
  properties: { id: TOOL_COMMON_PROPS.id },
  required: [],
  outputDescription:
    "Returns map of thing picoIDs to thing objects (name, subID, picoID, color, etc.)",
});

const manifold_create_thing = tool({
  name: "manifold_create_thing",
  description: "KRL event: manifold/create_thing (attrs: name)",
  properties: {
    ...TOOL_COMMON_PROPS,
    name: { type: "string", description: "Name for the new thing pico." },
  },
  required: ["name"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const manifold_remove_thing = tool({
  name: "manifold_remove_thing",
  description: "Remove a thing pico from Manifold by its name.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the thing to remove.",
    },
  },
  required: ["thingName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const manifold_change_thing_name = tool({
  name: "manifold_change_thing_name",
  description:
    "Rename a thing pico. Use the thing's current name and the new name.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The current name of the thing to rename.",
    },
    changedName: { type: "string", description: "The new name for the thing." },
  },
  required: ["thingName", "changedName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const safeandmine_newtag = tool({
  name: "safeandmine_newtag",
  description: "Assign a physical SquareTag to a named Pico.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: { type: "string", description: "The name of the Pico to tag." },
    tagID: { type: "string", description: "The alphanumeric tag ID." },
    domain: {
      type: "string",
      description: "Tag domain/type (e.g., sqtg).",
      default: "sqtg",
    },
  },
  required: ["thingName", "tagID"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const scanTag = tool({
  name: "scanTag",
  description: "Get owner info from a SquareTag scan.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    tagID: { type: "string", description: "The alphanumeric tag ID." },
    domain: {
      type: "string",
      description: "Tag domain/type (e.g., sqtg).",
      default: "sqtg",
    },
  },
  required: ["tagID"],
  outputDescription: "Returns the owner info for the scanned tag.",
});

module.exports = {
  tools: [
    manifold_getThings,
    manifold_create_thing,
    manifold_remove_thing,
    manifold_change_thing_name,
    safeandmine_newtag,
    scanTag,
  ],
};
