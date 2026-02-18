const { getRootECI } = require("../src/backend/utility/eci-utility.js");
const { setupRegistry } = require("../src/backend/utility/api-utility.js");

/**
 *
 * @param {*} retries the amount of retries to call the pico engine
 * @param {*} delayMs the time between retries
 *
 * In order to get the eci the pico engine needs to be up and running.
 * This function pings the pico engine until it returns a response
 * OR until it does 10 retries
 */
async function waitForECI(retries = 10, delayMs = 500) {
  // For the shell script we want to temporarily suppress console.error
  const originalConsoleError = console.error;
  console.error = () => {}; // Override to silent

  try {
    for (let i = 0; i < retries; i++) {
      const eci = await getRootECI();
      if (eci) return eci;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  } finally {
    // restore console.error
    console.error = originalConsoleError;
  }
  throw new Error(`Failed to get initial ECI after ${retries} attempts`);
}

async function main() {
  try {
    const eci = await waitForECI();
    console.log(`Using Pico ECI: ${eci}`);

    // This now blocks until the KRL bootstrap is 100% finished
    const bootstrapResults = await setupRegistry();

    // Since setupRegistry returns the status object, we can print it here
    console.log("\n\n✅ MANIFOLD BOOTSTRAP SUCCESSFUL");
    console.log("------------------------------------------");
    console.log(`Registry ECI:      ${bootstrapResults.tag_registry_eci}`);
    console.log(
      `Registration ECI:  ${bootstrapResults.tag_registry_registration_eci}`,
    );
    console.log(`Owner ECI:         ${bootstrapResults.owner_eci}`);
    console.log("------------------------------------------");
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  }
}

main();
