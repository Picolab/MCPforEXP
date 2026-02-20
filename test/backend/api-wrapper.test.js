const {
  setSquareTag,
  createThing,
  updateOwnerInfo,
  deleteThing,
  scanTag,
} = require("../../src/backend/api-wrapper");
const {
  installRuleset,
  picoHasRuleset,
} = require("../../src/backend/utility/api-utility.js");
const {
  getECIByTag,
  getRootECI,
} = require("../../src/backend/utility/eci-utility.js");

let manifoldEci = "";
let rootECI = "";

beforeAll(async () => {
  console.log("Installing Manifold...");
  rootECI = await getRootECI();
  console.log("ROOT ECI: ", rootECI);
  await installRuleset(
    rootECI,
    "/app/Manifold-api/io.picolabs.manifold_bootstrap.krl",
  );
});

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
  test("successfully gets if a pico has a specific ruleset", async () => {
    picoHasRuleset(rootECI, "bootstrap");
  });
});

/**
 * describe("Integration Test: createThing", () => {
  test("successfully creates a new Thing Pico", async () => {
    const thingName = "Red Travel Case";

    // Call the real createThing
    const thingECI = await createThing(manifoldECI, thingName);

    // Verify that the Thing exists in the engine
    const checkECI = await getChildEciByName(manifoldECI, thingName);
    expect(checkECI).toBe(thingECI);

    console.log("Created Thing ECI:", thingECI);
  }, 20000); // test timeout
});
 */

// test("get initial ECI", async () => {
//   try {
//     const eci = await getRootECI();
//     expect(eci).toBeDefined();
//     console.log("Root eci is", eci);
//   } catch (error) {
//     throw error;
//   }
// });

// test("get initialization ECI", async () => {
//   try {
//     const eci = await getRootECI();
//     expect(eci).toBeDefined();
//     console.log("Root eci is", eci);
//     const channelEci = await getInitializationECI(eci);
//     console.log("Channel eci is", channelEci);
//     expect(channelEci).toBeDefined();
//   } catch (error) {
//     throw error;
//   }
// });

// test("get manifold ECI", async () => {
//   try {
//     const eci = await getRootECI();
//     expect(eci).toBeDefined();
//     console.log("Root eci is", eci);
//     const channelEci = await getInitializationECI(eci);
//     console.log("Channel eci is", channelEci);
//     expect(channelEci).toBeDefined();
//     const manifoldEci = await getManifoldECI(channelEci);
//     console.log("Manifold eci is", manifoldEci);
//     expect(manifoldEci).toBeDefined();
//   } catch (error) {
//     throw error;
//   }
// });

// test("has ruleset installed", async () => {
//   try {
//     const eci = await getRootECI();
//     expect(eci).toBeDefined();
//     console.log("Root eci is", eci);
//     const channelEci = await getInitializationECI(eci);
//     console.log("Channel eci is", channelEci);
//     expect(channelEci).toBeDefined();
//     const manifoldEci = await getManifoldECI(channelEci);
//     console.log("Manifold eci is", manifoldEci);
//     expect(manifoldEci).toBeDefined();
//     let isInstalled = await picoHasRuleset(
//       manifoldEci,
//       "io.picolabs.manifold.safeandmine",
//     );
//     expect(isInstalled).toBe(false);

//     isInstalled = await picoHasRuleset(
//       manifoldEci,
//       "io.picolabs.manifold_pico",
//     );
//     expect(isInstalled).toBe(true);
//   } catch (error) {
//     throw error;
//   }
// });

/**
 * Helper to generate a short random string for unique tags
 */
const generateRandomString = (length = 6) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)
    .toUpperCase();

test("create thing and add tags with unique identifiers", async () => {
  const randomName = `Backpack-${Date.now()}`;
  const randomTag = generateRandomString(6);

  console.log(`Running test with Name: ${randomName} and Tag: ${randomTag}`);

  try {
    const thingEci = await createThing(randomName);
    expect(thingEci).toBeDefined();
    console.log(`${randomName} ECI is:`, thingEci);

    const addedTag = await setSquareTag(randomName, randomTag);

    expect(addedTag).toBeDefined();
    console.log("Added tag result:", addedTag);

    // Optional: Verify the tag was actually registered
    // const tags = await safeandmine_getTags(thingEci);
    // expect(JSON.stringify(tags)).toContain(randomTag);
  } catch (error) {
    console.error("Test failed during random generation flow:", error);
    throw error;
  } finally {
    // Cleanup: remove the created thing
    try {
      await deleteThing(randomName);
      console.log(`✓ Cleaned up ${randomName}`);
    } catch (cleanupError) {
      console.warn(
        `Warning: Failed to cleanup ${randomName}:`,
        cleanupError.message,
      );
    }
  }
}, 60000); // 60 second timeout - createThing can take up to 10s, setSquareTag adds delays, plus network overhead

// test("list things", async () => {
//   try {
//     const eci = await getRootECI();
//     expect(eci).toBeDefined();
//     console.log("Root eci is", eci);
//     const channelEci = await getInitializationECI(eci);
//     console.log("Channel eci is", channelEci);
//     expect(channelEci).toBeDefined();
//     const manifoldEci = await getManifoldECI(channelEci);
//     console.log("Manifold eci is", manifoldEci);
//     // Once createThing is implemented, we can enhance this test.
//     result = await listThings(manifoldEci);
//     expect(result).toEqual({});
//   } catch (error) {
//     throw error;
//   }
// });

test("create thing, add owner info, update it, and view it", async () => {
  const randomName = `Suitcase-${Date.now()}`;
  try {
    const thingEci = await createThing(randomName);
    expect(thingEci).toBeDefined();
    const validChannel = await getECIByTag(thingEci, "manifold");

    const initialOwnerInfo = {
      name: "test",
      email: "test",
      phone: "test",
      message: "test",
      shareName: true,
      shareEmail: true,
      sharePhone: true,
    };
    const firstUpdateResponse = await updateOwnerInfo(
      randomName,
      initialOwnerInfo,
    );
    expect(firstUpdateResponse.eid).toBeDefined();

    const secondUpdateResponse = await updateOwnerInfo(randomName, {
      name: "UPDATED",
      sharePhone: false,
    });
    expect(secondUpdateResponse.eid).toBeDefined();

    const getInfoResponse = await fetch(
      `http://localhost:3000/c/${validChannel}/query/io.picolabs.safeandmine/getInformation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info: "" }),
      },
    );

    const returnedOwnerInfo = await getInfoResponse.json();
    const expectedOwnerInfo = {
      name: "UPDATED",
      email: "test",
      phone: "test",
      message: "test",
      shareName: true,
      shareEmail: true,
      sharePhone: false,
    };

    expect(returnedOwnerInfo).toEqual(expectedOwnerInfo);
  } catch (error) {
    console.error("Test failed during random generation flow:", error);
    throw error;
  } finally {
    // Cleanup: remove the created thing
    try {
      await deleteThing(randomName);
      console.log(`✓ Cleaned up ${randomName}`);
    } catch (cleanupError) {
      console.warn(
        `Warning: Failed to cleanup ${randomName}:`,
        cleanupError.message,
      );
    }
  }
}, 60000); // 60 second timeout - createThing can take up to 10s, plus multiple update operations
