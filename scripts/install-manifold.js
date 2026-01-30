const {
  installOwner,
  getRootECI,
  setupRegistry,
} = require("../src/backend/api-wrapper.js");

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
    // 1. Wait for the engine to actually wake up
    const eci = await waitForECI();
    console.log(`Using Pico ECI: ${eci}`);

    // 2. Install the Bootstrap Orchestrator (Step 0)
    // This triggers the KRL rules you wrote to start the chain reaction
    await setupRegistry();
    console.log(
      "Bootstrap ruleset installed. Monitoring engine for completion...",
    );

    // 3. Poll the UI ruleset to see when the KRL finishes its work
    // We check the 'ent' variables of our bootstrap ruleset
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Query the UI ruleset (which is always allowed for this ECI)
        const resp = await fetch(
          `http://127.0.0.1:3000/c/${eci}/query/io.picolabs.pico-engine-ui/pico`,
        );

        if (resp.ok) {
          const picoState = await resp.json();

          // Access the persistent variables (ent) stored by your bootstrap ruleset
          const bootstrapVars =
            picoState.ent?.["io.picolabs.manifold_bootstrap"];

          if (bootstrapVars && bootstrapVars.owner_eci) {
            console.log("\n\n✅ MANIFOLD BOOTSTRAP SUCCESSFUL");
            console.log("------------------------------------------");
            console.log(`Registry ECI:      ${bootstrapVars.tag_registry_eci}`);
            console.log(
              `Registration ECI:  ${bootstrapVars.tag_registry_registration_eci}`,
            );
            console.log(`Owner ECI:         ${bootstrapVars.owner_eci}`);
            console.log("------------------------------------------");
            return; // Success! Exit the script
          }
        }
      } catch (err) {
        // Suppress errors during polling (engine might be busy creating picos)
      }

      // Visual progress indicator
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(
      "Bootstrap timed out. The KRL started, but never reached the final 'Owner' step.",
    );
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  }
}

main();
