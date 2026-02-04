/**
 * Manual test script to verify MCP server can communicate with Manifold.
 * 
 * This script:
 * 1. Gets the manifold pico ECI
 * 2. Tests a few key operations (getThings, create_thing, etc.)
 * 3. Prints results in a readable format
 * 
 * Run: node scripts/test-mcp-manual.js
 */

const api = require("../src/backend/api-wrapper");

/**
 * Helper function to check if a result actually succeeded.
 * KRL queries can return errors in the data field even when HTTP status is 200.
 */
function isSuccess(result) {
  if (!result || !result.ok) {
    return false;
  }
  // Check if data contains an error field (common KRL error pattern)
  if (result.data && typeof result.data === 'object') {
    // Check if error property exists and has a truthy value (null/undefined are considered "no error")
    if ('error' in result.data && result.data.error !== null && result.data.error !== undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Helper to extract error message from a result
 */
function getErrorMessage(result) {
  if (result.error) {
    return result.error.message || JSON.stringify(result.error);
  }
  if (result.data?.error) {
    return typeof result.data.error === 'string' 
      ? result.data.error 
      : JSON.stringify(result.data.error);
  }
  return "Unknown error";
}

async function testManifoldConnection() {
  console.log("=".repeat(60));
  console.log("Manual MCP Server → Manifold Connection Test");
  console.log("=".repeat(60));
  console.log();

  try {
    // Step 1: Get manifold ECI (using the correct channel with proper permissions)
    console.log("Step 1: Getting Manifold pico ECI...");
    const rootECI = await api.getRootECI();
    if (!rootECI) {
      throw new Error("Failed to get root ECI. Is pico-engine running on localhost:3000?");
    }
    console.log("✓ Root ECI:", rootECI);

    const OwnerECI = await api.getChildEciByName(rootECI, "Owner");
    if (!OwnerECI) {
      throw new Error("Failed to get owner ECI");
    }
    console.log("✓ Owner ECI:", OwnerECI);

    // Get the Owner's initialization ECI (channel with proper permissions)
    const ownerInitializationECI = await api.getInitializationECI(OwnerECI);
    if (!ownerInitializationECI) {
      throw new Error("Failed to get owner initialization ECI");
    }
    console.log("✓ Owner Initialization ECI:", ownerInitializationECI);

    // Get the manifold channel ECI (not the pico ECI, but the channel with "manifold" tag)
    const manifoldECI = await api.getManifoldECI(ownerInitializationECI);
    if (!manifoldECI) {
      throw new Error("Failed to get manifold ECI. Run 'npm run setup' first?");
    }
    console.log("✓ Manifold ECI:", manifoldECI);
    console.log();

    // Step 2: Test getThings query
    console.log("Step 2: Testing manifold_getThings query...");
    const getThingsResult = await api.manifold_getThings(manifoldECI);
    console.log("Result:", JSON.stringify(getThingsResult, null, 2));
    if (isSuccess(getThingsResult)) {
      console.log("✓ Query succeeded!");
      const thingCount = Object.keys(getThingsResult.data || {}).length;
      console.log(`  Found ${thingCount} thing(s)`);
    } else {
      console.log("✗ Query failed:", getErrorMessage(getThingsResult));
    }
    console.log();

    // Step 3: Test isAChild query
    if (isSuccess(getThingsResult) && Object.keys(getThingsResult.data || {}).length > 0) {
      const firstThingPicoID = Object.keys(getThingsResult.data)[0];
      console.log(`Step 3: Testing manifold_isAChild with picoID: ${firstThingPicoID}...`);
      const isChildResult = await api.manifold_isAChild(manifoldECI, firstThingPicoID);
      console.log("Result:", JSON.stringify(isChildResult, null, 2));
      if (isSuccess(isChildResult)) {
        console.log("✓ Query succeeded!");
        console.log(`  Is child: ${isChildResult.data}`);
      } else {
        console.log("✗ Query failed:", getErrorMessage(isChildResult));
      }
      console.log();
    } else {
      console.log("Step 3: Skipping isAChild test (no things found or getThings failed)");
      console.log();
    }

    // Step 4: Test create_thing event
    console.log("Step 4: Testing manifold_create_thing event...");
    const testThingName = `test-thing-${Date.now()}`;
    const createResult = await api.manifold_create_thing(manifoldECI, testThingName);
    console.log("Result:", JSON.stringify(createResult, null, 2));
    if (isSuccess(createResult) && createResult.meta?.httpStatus === 200) {
      console.log("✓ Event succeeded!");
      console.log(`  Created thing: ${testThingName}`);
    } else {
      console.log("✗ Event failed:", getErrorMessage(createResult) || "HTTP status not 200");
    }
    console.log();

    // Step 5: Verify the new thing appears
    console.log("Step 5: Verifying new thing appears in getThings...");
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s for pico to process
    const verifyResult = await api.manifold_getThings(manifoldECI);
    if (isSuccess(verifyResult)) {
      const things = verifyResult.data || {};
      const found = Object.values(things).some((thing) => thing.name === testThingName);
      if (found) {
        console.log("✓ New thing found in getThings!");
      } else {
        console.log("⚠ New thing not yet visible (may need more time)");
      }
    } else {
      console.log("✗ Failed to verify:", getErrorMessage(verifyResult));
    }
    console.log();

    // Step 6: Test safeandmine operations (if we have a thing pico)
    if (isSuccess(verifyResult) && Object.keys(verifyResult.data || {}).length > 0) {
      const firstThing = Object.values(verifyResult.data)[0];
      const thingPicoID = firstThing.picoID || firstThing.picoId;
      
      if (thingPicoID) {
        console.log(`Step 6: Getting thing pico ECI for picoID: ${thingPicoID}...`);
        
        // Get the thing pico's actual ECI by querying wrangler on the manifold pico
        // We need to get the child pico's channels to find its ECI
        try {
          const thingChannelsResp = await fetch(
            `http://localhost:3000/c/${manifoldECI}/query/io.picolabs.wrangler/children`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
          );
          
          if (thingChannelsResp.ok) {
            const children = await thingChannelsResp.json();
            const thingChild = Array.isArray(children) 
              ? children.find(c => c.id === thingPicoID)
              : null;
            
            if (thingChild && thingChild.eci) {
              const thingECI = thingChild.eci;
              console.log(`✓ Found thing ECI: ${thingECI}`);
              
              // First, ensure safeandmine is installed
              console.log(`  Installing safeandmine ruleset if needed...`);
              await api.addTags(thingECI, null);
              await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for installation
              
              // Now test safeandmine query
              console.log(`  Testing safeandmine_getTags...`);
              const tagsResult = await api.safeandmine_getTags(thingECI);
              console.log("Result:", JSON.stringify(tagsResult, null, 2));
              if (isSuccess(tagsResult)) {
                console.log("✓ Query succeeded!");
                console.log(`  Tags: ${JSON.stringify(tagsResult.data)}`);
              } else {
                console.log("⚠ Query returned error:", getErrorMessage(tagsResult));
                console.log("  (This is expected if safeandmine isn't fully installed yet)");
              }
            } else {
              console.log("⚠ Could not find thing pico ECI from children list");
            }
          } else {
            console.log("⚠ Could not query wrangler children");
          }
        } catch (err) {
          console.log("⚠ Error getting thing ECI:", err.message);
          console.log("  Note: safeandmine queries require the thing pico's actual ECI, not subscription channels");
        }
        console.log();
      }
    }

    console.log("=".repeat(60));
    console.log("Test Summary:");
    console.log("✓ All basic operations tested");
    console.log("✓ Check results above for any failures");
    console.log("=".repeat(60));

  } catch (error) {
    console.error();
    console.error("=".repeat(60));
    console.error("TEST FAILED:", error.message);
    console.error("=".repeat(60));
    console.error();
    console.error("Troubleshooting:");
    console.error("1. Is pico-engine running? (pico-engine)");
    console.error("2. Have you run 'npm run setup'?");
    console.error("3. Check that localhost:3000 is accessible");
    process.exit(1);
  }
}

// Run the test
testManifoldConnection();
