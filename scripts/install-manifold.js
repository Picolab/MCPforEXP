const { installOwner, getInitialECI } = require('../src/backend/api-wrapper.js');


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
        const eci = await getInitialECI();
        if (eci) return eci;
            await new Promise(r => setTimeout(r, delayMs));
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
    await installOwner(eci);
    console.log('manifold_owner installed successfully.');
  } catch (error) {
    console.error('Error installing manifold_owner:', error.message);
    process.exit(1);
  }
}

main();
