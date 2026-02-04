const {
  addTag,
  setSquareTag,
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

test("add tags", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
    const ownerEci = await getChildEciByName(eci, "Owner");
    console.log("Owner eci is", ownerEci);
    expect(ownerEci).toBeDefined();
    const initializedEci = await getInitializationECI(ownerEci);
    console.log("Initialized eci is", initializedEci);
    expect(initializedEci).toBeDefined();
    const manifoldEci = await getManifoldECI(initializedEci);
    expect(manifoldEci).toBeDefined();
    console.log("Manifold eci is", manifoldEci);

    // Create things to add tags to
    const thingEci = await createThing(manifoldEci, "Test Thing");
    console.log("Thing eci is", thingEci);
    expect(thingEci).toBeDefined();
    isInstalled = await picoHasRuleset(thingEci, "io.picolabs.safeandmine");
    expect(isInstalled).toBe(true);
    // Need to find the things manifold ECI to add tags
    const thingManifoldEci = await getECIByTag(thingEci, "manifold");
    console.log("Thing manifold eci is", thingManifoldEci);
    expect(thingManifoldEci).toBeDefined();
    const addedTag = await setSquareTag(thingManifoldEci, "fake tag");
    expect(addedTag).toBeDefined();
  } catch (error) {
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
