const {
  setSquareTag,
  createThing,
  updateOwnerInfo,
  deleteThing,
  scanTag,
} = require("../../src/backend/api-wrapper.js");
const {
  installRuleset,
  picoHasRuleset,
  sesetupRegistry,
  setupRegistry,
} = require("../../src/backend/utility/api-utility.js");
const {
  getECIByTag,
  getRootECI,
  traverseHierarchy,
  getManifoldECI,
  getChildEciByName,
  getSkillsRegistryECI, // New Import
} = require("../../src/backend/utility/eci-utility.js");
const {
  getFetchRequest,
} = require("../../src/backend/utility/http-utility.js");

// Skills Registry Imports
const {
  getSkills,
  addSkill,
  removeSkill,
  addToolToSkill,
  removeToolFromSkill,
} = require("../../src/backend/skills-registry-wrapper.js");

let manifold_eci = "";
let rootECI = "";
let owner_eci = "";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  console.log("Installing Manifold...");
  rootECI = await getRootECI();
  console.log("ROOT ECI: ", rootECI);

  await installRuleset(
    rootECI,
    "https://raw.githubusercontent.com/Picolab/MCPforEXP/refs/heads/main/Manifold-api/io.picolabs.manifold_bootstrap.krl",
  );
  await wait(5000);
  owner_eci = await getChildEciByName(rootECI, "Owner");
  console.log("OWNER ECI: ", owner_eci);
  manifold_eci = await traverseHierarchy();
  console.log("MANIFOLD ECI: ", manifold_eci);
}, 20000);

// --- Existing Integration Tests ---

describe("Integration Test: getRootECI", () => {
  test("successfully calls rootECI without error", async () => {
    await expect(getRootECI()).resolves.not.toThrow();
  }, 20000);

  test("getRootECI matches our rootECI retrieved in beforeAll", async () => {
    const newRootECI = await getRootECI();
    await expect(newRootECI).toEqual(rootECI);
  });
});

describe("Integration Test: getECIByTag", () => {
  test("successfully calls getECIByTag without erroring", async () => {
    await expect(getRootECI()).resolves.not.toThrow();
  });
});

describe("integration Test: picoHasRuleset", () => {
  test("picoHasRuleset is called and does not throw an error", async () => {
    await expect(picoHasRuleset(rootECI, "bootstrap")).resolves.not.toThrow();
  });

  test("successfully gets if a pico has a specific ruleset", async () => {
    const result = await picoHasRuleset(
      rootECI,
      "io.picolabs.manifold_bootstrap",
    );
    expect(result).toEqual(true);
  });
});

describe("integration test: installRuleset", () => {
  test("successfully installs a ruleset", async () => {
    //TODO: create a thing, and install safe and mine on the thing.
  });
});

describe("integrationTest: traverseHierarchy", () => {
  test("calls traverseHierarchy without error", async () => {
    await expect(traverseHierarchy()).resolves.not.toThrow();
  });

  test("traverseHierachy retrieves the same manifold ECI as beforeAll", async () => {
    const manECI = await traverseHierarchy();
    expect(manECI).toEqual(manifold_eci);
  });
});

describe("integrationTest: getManifoldECI", () => {
  test("calls getmanfoldECI without error", async () => {
    await expect(getManifoldECI(owner_eci)).resolves.not.toThrow();
  });

  test("getManifoldECI doesn't return null", async () => {
    const returnValue = await getManifoldECI(owner_eci);
    expect(returnValue).not.toEqual(null);
  });
});

// --- New Skills Registry Integration Tests ---

describe("Integration Test: Skills Registry", () => {
  test("Get Skills Registry ECI", async () => {
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
    await addSkill("SafeAndMine", "io.picolabs.safeandmine.krl", {
      "Test Tool": "Test tool placeholder content",
    });
    const response = await removeSkill("SafeAndMine");
    expect(response.directives[0].name).toEqual("skill removed");
  });

  test("Add Tool", async () => {
    await addSkill("SafeAndMine", "io.picolabs.safeandmine.krl", {
      "Test Tool": "Test tool placeholder content",
    });
    const addedTool = await addToolToSkill(
      "SafeAndMine",
      "Test Tool 2",
      "Test tool 2 placeholder content",
    );
    expect(addedTool.directives[0].name).toEqual("tool updated");
  });

  test("Remove Tool", async () => {
    await addSkill("SafeAndMine", "io.picolabs.safeandmine.krl", {
      "Test Tool": "Test tool placeholder content",
    });
    await addToolToSkill(
      "SafeAndMine",
      "Test Tool 2",
      "Test tool 2 placeholder content",
    );
    const removedTool = await removeToolFromSkill("SafeAndMine", "Test Tool 2");
    expect(removedTool.directives[0].name).toEqual("tool removed");
  });
});
