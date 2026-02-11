const {
  setSquareTag,
  scanTag,
  listThings,
  createThing,
} = require("../../src/backend/api-wrapper");
const {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  picoHasRuleset,
  getECIByTag,
  getChildEciByName,
} = require("../../src/backend/utility");

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
  }
});

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
