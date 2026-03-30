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

function tool({
  name,
  description,
  properties,
  required,
  outputDescription,
  skill,
}) {
  return {
    name,
    description,
    // Logical grouping for dynamic tool exposure based on installed Skills
    // e.g. "manifold_core", "safeandmine", "journal"
    skill,
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
  skill: "manifold_core",
  description:
    "List all digital things managed by Manifold. No arguments required.",
  properties: { id: TOOL_COMMON_PROPS.id },
  required: [],
  outputDescription:
    "Returns map of thing picoIDs to thing objects (name, subID, picoID, color, etc.)",
});

const manifold_create_thing = tool({
  name: "manifold_create_thing",
  skill: "manifold_core",
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
  skill: "manifold_core",
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
  skill: "manifold_core",
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

const manifold_getThingSkills = tool({
  name: "manifold_getThingSkills",
  skill: "manifold_core",
  description:
    "Derive which Skills are installed on a Thing by checking installed KRL rulesets.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the Thing pico to inspect for installed Skills.",
    },
  },
  required: ["thingName"],
  outputDescription:
    "Returns { thingName, skills: string[] } in data, where skills are logical groups like manifold_core, safeandmine, journal.",
});

const manifold_installSkill = tool({
  name: "manifold_installSkill",
  skill: "manifold_core",
  description:
    "Install a logical Skill on a Thing by installing its backing KRL ruleset (e.g., journal, safeandmine).",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the Thing pico to install the Skill on.",
    },
    skillName: {
      type: "string",
      description:
        "Logical Skill name to install (e.g., 'journal' or 'safeandmine').",
    },
  },
  required: ["thingName", "skillName"],
  outputDescription:
    "Returns installation metadata, including which Skill and RID were installed for the Thing.",
});

const safeandmine_newtag = tool({
  name: "safeandmine_newtag",
  skill: "safeandmine",
  description: "Assign a physical tag to a named Pico.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: { type: "string", description: "The name of the Pico to tag." },
    tagID: { type: "string", description: "The alphanumeric tag ID." },
    domain: {
      type: "string",
      description: "Tag domain/type (e.g., sqtg).",
    },
  },
  required: ["thingName", "tagID"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const scanTag = tool({
  name: "scanTag",
  skill: "safeandmine",
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

const updateOwnerInfo = tool({
  name: "updateOwnerInfo",
  skill: "safeandmine",
  description: "Update owner info for a thing.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the thing to update.",
    },
    ownerInfo: {
      type: "object",
      description: "The owner information to update.",
      properties: {
        name: { type: "string", description: "The owner's name." },
        email: { type: "string", description: "The owner's email." },
        phone: { type: "string", description: "The owner's phone number." },
        message: { type: "string", description: "A message about the owner." },
        shareName: {
          type: "boolean",
          description: "Whether to share the owner's name.",
        },
        sharePhone: {
          type: "boolean",
          description: "Whether to share the owner's phone number.",
        },
        shareEmail: {
          type: "boolean",
          description: "Whether to share the owner's email.",
        },
      },
      required: [],
    },
  },
  required: ["thingName", "ownerInfo"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const addNote = tool({
  name: "addNote",
  skill: "journal",
  description: "Add a note to a thing.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the thing to add a note to.",
    },
    title: { type: "string", description: "The title of the note." },
    content: { type: "string", description: "The content of the note." },
  },
  required: ["thingName", "title", "content"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
});

const getNote = tool({
  name: "getNote",
  skill: "journal",
  description: "Get a note from a thing by title.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the thing to get a note from.",
    },
    title: {
      type: "string",
      description: "The title of the note to retrieve.",
    },
  },
  required: ["thingName", "title"],
  outputDescription: "Returns the content of the requested note.",
});

const manifold_getCommunities = tool({
  name: "manifold_getCommunities",
  skill: "manifold_core",
  description:
    "List all digital communities managed by Manifold. No arguments required.",
  properties: { id: TOOL_COMMON_PROPS.id },
  required: [],
  outputDescription:
    "Returns map of community picoIDs to community objects (name, subID, picoID, color, etc.)",
})

const manifold_create_community = tool({
  name: "manifold_create_community",
  skill: "manifold_core",
  description: "KRL event: manifold/new_community (attrs: name)",
  properties: {
    ...TOOL_COMMON_PROPS,
    communityName: { type: "string", description: "Name for the new community pico." },
    description: { type: string, description: "Description for the new community pico."}
  },
  required: ["communityName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
})

const manifold_add_thing_to_community = tool({
  name: "manifold_add_thing_to_community",
  skill: "manifold_core",
  description: "KRL event: manifold/add_thing_to_community (attrs: name)", // TODO: CHECK THIS.
  properties: {
    id: TOOL_COMMON_PROPS.id,
    thingName: {
      type: "string",
      description: "The name of the thing that is added to the community."
    },
    communityName: {
      type: "string",
      description: "The name of the community to add a note to.",
    },
  },
  required: ["thingName", "communityName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
})

const manifold_get_community_things = tool({
  name: "manifold_get_community_things",
  skill: "manifold_core",
  description: "List all Things that are attached to a Community",
  properties: {
    ...TOOL_COMMON_PROPS,
    communityName: { type: "string", description: "Name for the Community pico that Things will be pulled from." },
  },
  required: ["communityName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)"
})

const manifold_get_community_description = tool({
  name: "manifold_get_community_description",
  skill: "manifold_core",
  description: "List the description that is associated with a Community",
  properties: {
    ...TOOL_COMMON_PROPS,
    communityName: { type: "string", description: "Name for the Community pico that the description will be pulled from." },
  },
  required: ["communityName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)"
})

const manifold_remove_community = tool({
  name: "manifold_remove_community",
  skill: "manifold_core",
  description: "Remove a community pico from Manifold by its name.",
  properties: {
    id: TOOL_COMMON_PROPS.id,
    communityName: {
      type: "string",
      description: "The name of the community to remove.",
    },
  },
  required: ["communityName"],
  outputDescription:
    "Event result (typically empty data object, check meta.httpStatus for success)",
})

const ALL_TOOLS = [
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
];

// Index tools by Skill name for dynamic tool exposure:
// { [skillName: string]: string[] } mapping Skill -> MCP tool names
const SKILL_TOOL_INDEX = ALL_TOOLS.reduce((acc, t) => {
  const skillName = t.skill || "manifold_core";
  if (!acc[skillName]) {
    acc[skillName] = [];
  }
  acc[skillName].push(t.name);
  return acc;
}, {});

module.exports = {
  tools: ALL_TOOLS,
  SKILL_TOOL_INDEX,
};
