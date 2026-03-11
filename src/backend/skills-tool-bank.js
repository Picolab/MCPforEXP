const { tools, SKILL_TOOL_INDEX } = require("./mcp-server/tools.js");
const { getSkills } = require("./skills-registry-wrapper.js");

/**
 * Static Skill → tool mapping derived from local MCP tool definitions.
 *
 * Example shape:
 * {
 *   manifold_core: ["manifold_getThings", "manifold_create_thing", ...],
 *   safeandmine:   ["safeandmine_newtag", "scanTag", "updateOwnerInfo"],
 *   journal:       ["addNote", "getNote"]
 * }
 */
function getStaticSkillToolBank() {
  return { ...SKILL_TOOL_INDEX };
}

/**
 * Return full MCP tool specs for a given list of Skill names.
 * This is what an orchestrator / client can use to expose only tools
 * for the Skills installed on a particular Thing.
 *
 * @param {string[]} skillNames
 * @returns {object[]} Array of MCP tool descriptors (from src/backend/mcp-server/tools.js)
 */
function getToolsForSkills(skillNames = []) {
  if (!Array.isArray(skillNames) || skillNames.length === 0) {
    return [];
  }

  const skillSet = new Set(skillNames);
  return tools.filter((t) => t.skill && skillSet.has(t.skill));
}

/**
 * Optional helper to read the live Skills Registry pico and return
 * whatever it currently knows about Skills. This does not yet drive
 * MCP tool registration directly, but gives you a single place to
 * look up Skills metadata if you want to sync or introspect.
 *
 * @returns {Promise<object[]>}
 */
async function getRegisteredSkills() {
  return getSkills();
}

module.exports = {
  getStaticSkillToolBank,
  getToolsForSkills,
  getRegisteredSkills,
};

