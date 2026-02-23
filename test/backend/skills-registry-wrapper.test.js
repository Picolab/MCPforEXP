const {
  getSkillsRegistryECI,
} = require("../../src/backend/utility/eci-utility.js");
const {
  getSkills,
  addSkill,
} = require("../../src/backend/skills-registry-wrapper.js");

test("Get ECI", async () => {
  const eci = await getSkillsRegistryECI();
  expect(eci).toBeDefined();
});

test("Add Skills", async () => {
  const response = await addSkill(
    "SafeAndMine",
    "io.picolabs.safeandmine.krl",
    "Tools placeholder",
  );
  expect(response.directives[0].name).toEqual("skill registered");
});

test("Get Skills", async () => {
  await addSkill(
    "SafeAndMine",
    "io.picolabs.safeandmine.krl",
    "Tools placeholder",
  );
  const oneSkill = await getSkills("SafeAndMine");
  expect(oneSkill.name).toEqual("SafeAndMine");
  await addSkill("Journal", "io.picolabs.journal.krl", "Tools placeholder");
  const multipleSkills = await getSkills();
  expect(multipleSkills.SafeAndMine).toBeDefined();
  expect(multipleSkills.Journal).toBeDefined();
});
