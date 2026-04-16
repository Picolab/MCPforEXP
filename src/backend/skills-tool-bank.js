const { tools, SKILL_TOOL_INDEX } = require("./mcp-server/tools.js");
const { getSkills } = require("./skills-registry-wrapper.js");

/**
 * SKILL GATING STRATEGY:
 * To prevent 'Tool Hallucination' and 'Unauthorized Access Errors', we use
 * Skill Gating.
 * 1. Picos are dynamic; they only 'know' how to handle events for rulesets
 * currently installed on them.
 * 2. This module filters the global Tool list into a 'Sub-Manifest' based
 * on a Pico's active Skills.
 * 3. The LLM Client (orchestrator) uses this to dynamically reconstruct
 * the 'available_tools' list for every request.
 */

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
  /**
   * THE GATE:
   * We iterate through every tool in the MCP definition. If a tool requires
   * the 'journal' skill, but 'journal' is not in the 'skillSet', that tool
   * is 'gated' (removed).
   * RESULT: The LLM will never even know 'addNote' exists unless the
   * Pico is ready to receive it.
   */
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
