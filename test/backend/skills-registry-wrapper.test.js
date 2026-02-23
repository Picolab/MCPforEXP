const {
  getSkillsRegistryECI,
} = require("../../src/backend/utility/eci-utility.js");
const {
  getSkills,
  addSkill,
  removeSkill,
  addToolToSkill,
} = require("../../src/backend/skills-registry-wrapper.js");

test("Get ECI", async () => {
  const eci = await getSkillsRegistryECI();
  expect(eci).toBeDefined();
});

test("Add Skills", async () => {
  const response = await addSkill(
    "SafeAndMine",
    "io.picolabs.safeandmine.krl",
    { "Test Tool": "Test tool placeholder content" },
  );
  expect(response.directives[0].name).toEqual("skill registered");
});

test("Get Skills", async () => {
  await addSkill("SafeAndMine", "io.picolabs.safeandmine.krl", {
    "Test Tool": "Test tool placeholder content",
  });
  const oneSkill = await getSkills("SafeAndMine");
  expect(oneSkill.name).toEqual("SafeAndMine");
  await addSkill("Journal", "io.picolabs.journal.krl", {
    "Test Tool": "Test tool placeholder content",
  });
  const multipleSkills = await getSkills();
  expect(multipleSkills.SafeAndMine).toBeDefined();
  expect(multipleSkills.Journal).toBeDefined();
});

test("Remove Skill", async () => {
  const addedSkill = await addSkill(
    "SafeAndMine",
    "io.picolabs.safeandmine.krl",
    { "Test Tool": "Test tool placeholder content" },
  );
  const response = await removeSkill("SafeAndMine");
  expect(response.directives[0].name).toEqual("skill removed");
});

test("Add Tool", async () => {
  const addedSkill = await addSkill(
    "SafeAndMine",
    "io.picolabs.safeandmine.krl",
    { "Test Tool": "Test tool placeholder content" },
  );
  const addedTool = await addToolToSkill(
    "SafeAndMine",
    "Test Tool 2",
    "Test tool 2 placeholder content",
  );
  expect(addedTool.directives[0].name).toEqual("tool updated");
});
