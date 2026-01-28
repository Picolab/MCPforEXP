const {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  picoHasRuleset,
  addTags,
} = require("../../src/backend/api-wrapper");

test("get initial ECI", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
  } catch (error) {
    throw error;
  }
});

test("get initialization ECI", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
    const channelEci = await getInitializationECI(eci);
    console.log("Channel eci is", channelEci);
    expect(channelEci).toBeDefined();
  } catch (error) {
    throw error;
  }
});

test("get manifold ECI", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
    const channelEci = await getInitializationECI(eci);
    console.log("Channel eci is", channelEci);
    expect(channelEci).toBeDefined();
    const manifoldEci = await getManifoldECI(channelEci);
    console.log("Manifold eci is", manifoldEci);
    expect(manifoldEci).toBeDefined();
  } catch (error) {
    throw error;
  }
});

test("has ruleset installed", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
    const channelEci = await getInitializationECI(eci);
    console.log("Channel eci is", channelEci);
    expect(channelEci).toBeDefined();
    const manifoldEci = await getManifoldECI(channelEci);
    console.log("Manifold eci is", manifoldEci);
    expect(manifoldEci).toBeDefined();
    let isInstalled = await picoHasRuleset(
      manifoldEci,
      "io.picolabs.manifold.safeandmine",
    );
    expect(isInstalled).toBe(false);

    isInstalled = await picoHasRuleset(
      manifoldEci,
      "io.picolabs.manifold_pico",
    );
    expect(isInstalled).toBe(true);
  } catch (error) {
    throw error;
  }
});

test("add tags", async () => {
  try {
    const eci = await getRootECI();
    expect(eci).toBeDefined();
    console.log("Root eci is", eci);
    const channelEci = await getInitializationECI(eci);
    console.log("Channel eci is", channelEci);
    expect(channelEci).toBeDefined();
    const manifoldEci = await getManifoldECI(channelEci);
    console.log("Manifold eci is", manifoldEci);
    isInstalled = await picoHasRuleset(manifoldEci, "io.picolabs.safeandmine");
    expect(isInstalled).toBe(false);
    const addedTag = await addTags(manifoldEci, "fake tag");
    expect(addedTag).toBeDefined();
  } catch (error) {
    throw error;
  }
});
