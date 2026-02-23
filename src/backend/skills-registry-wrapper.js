const { getSkillsRegistryECI } = require("./utility/eci-utility.js");

/**
 * Gets all available skills, or searches for a single skill by name if given the name as an argument
 * @async
 * @function getSkills
 * @param {string} [name=""] - The name of the skill to search for, or none to return all skills
 * @returns {Promise<object[]>} List of all skills, or just the skill you request. Returns an empty list if there are no skills/your requested skill can't be found
 */
async function getSkills(skillName = "") {
  const eci = await getSkillsRegistryECI();

  const response = await fetch(
    `http://localhost:3000/c/${eci}/query/io.picolabs.manifold.skills_registry/getSkills`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: skillName }),
    },
  );

  const data = await response.json();
  return data;
}

/**
 * Add a new skill to the skill registry, specifying its name, rid, tools, and optionally the URL of its KRL
 * @async
 * @function addSkill
 * @param {string} [skillName] - The name of the skill to create
 * @param {string} [rid] - The rule ID of the skill (ex: io.picolabs.manifold_owner.krl)
 * @param {string} [tools] - A stringified map of tools the skill provides
 * @param {string} [url=""] - Optional URL of the skill's KRL
 * @returns {Promise<object>} - Pico event response
 */
async function addSkill(skillName, rid, tools, url = "") {
  const eci = await getSkillsRegistryECI();

  const response = await fetch(
    `http://localhost:3000/c/${eci}/event-wait/manifold/new_skill_available`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: skillName,
        rid: rid,
        tools: tools,
        url: url,
      }),
    },
  );

  const data = await response.json();
  return data;
}

/**
 * Remove a specified skill from the skills registry
 * @async
 * @function removeSkill
 * @param {string} [skillName] - The name of the skill to remove
 * @returns {Promise<object>} - Pico event response
 */
async function removeSkill(skillName) {
  const eci = await getSkillsRegistryECI();

  const response = await fetch(
    `http://localhost:3000/c/${eci}/event-wait/manifold/remove_skill`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: skillName,
      }),
    },
  );

  const data = await response.json();
  return data;
}

/**
 * Add a new tool to an existing skill, specifying the skill name, the tool name, and its content
 * @async
 * @function addToolToSkill
 * @param {string} [skillName] - The name of the skill to add a tool to
 * @param {string} [toolName] - The name of the tool being added
 * @param {string} [toolContent] - The content of the tool
 * @returns {Promise<object>} - Pico event response
 */
async function addToolToSkill(skillName, toolName, toolContent) {
  const eci = await getSkillsRegistryECI();

  const response = await fetch(
    `http://localhost:3000/c/${eci}/event-wait/manifold/new_tool_available`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: skillName,
        tool_name: toolName,
        tool: toolContent,
      }),
    },
  );

  const data = await response.json();
  return data;
}

/**
 * Remove an existing tool from an existing skill, specifying the skill name and the tool name
 * @async
 * @function removeToolFromSkill
 * @param {string} [skillName] - The name of the skill to remove the tool from
 * @param {string} [toolName] - The name of the tool being removed
 * @returns {Promise<object>} - Pico event response
 */
async function removeToolFromSkill(skillName, toolName) {
  const eci = await getSkillsRegistryECI();

  const response = await fetch(
    `http://localhost:3000/c/${eci}/event-wait/manifold/remove_tool`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: skillName,
        tool_name: toolName,
      }),
    },
  );

  const data = await response.json();
  return data;
}

module.exports = {
  getSkills,
  addSkill,
  removeSkill,
  addToolToSkill,
  removeToolFromSkill,
};
