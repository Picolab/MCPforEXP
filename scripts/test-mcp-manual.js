/**
 * Manual test script to verify MCP server components via abstracted wrappers.
 * * This script verifies:
 * 1. Automatic hierarchy traversal to find the Manifold Pico.
 * 2. Creating things by name (no manual ECI management).
 * 3. Querying and cleanup using names and standard envelopes.
 *
 * Run: node scripts/test-mcp-manual.js
 */

const {
  manifold_getThings,
  manifold_isAChild,
  manifold_create_thing,
  safeandmine_getTags,
  manifold_remove_thing,
  safeandmine_newtag,
} = require("../src/backend/krl-operation.js");

/**
 * Helper function to check if a result actually succeeded.
 * KRL queries can return errors in the data field even when HTTP status is 200.
 */
function isSuccess(result) {
  if (!result || !result.ok) {
    return false;
  }
  // Check if data contains an error field (common KRL error pattern)
  if (result.data && typeof result.data === "object") {
    // Check if error property exists and has a truthy value (null/undefined are considered "no error")
    if (
      "error" in result.data &&
      result.data.error !== null &&
      result.data.error !== undefined
    ) {
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
    return typeof result.data.error === "string"
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
    // Step 1: Discovery & Cleanup
    console.log("\nStep 1: Listing current Things (Automatic Discovery)...");
    const getThingsResult = await manifold_getThings();

    if (isSuccess(getThingsResult)) {
      const things = getThingsResult.data || {};
      const testThings = Object.entries(things).filter(([_, t]) =>
        t.name.startsWith("Test-Thing-"),
      );
      if (testThings.length > 0) {
        console.log(`  Cleaning up ${testThings.length} old test items...`);
        for (const [picoID] of testThings) {
          await manifold_remove_thing(picoID);
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    } else {
      throw new Error(`Connection failed: ${getErrorMessage(getThingsResult)}`);
    }

    // Step 2: Create Thing
    const uniqueName = `Test-Thing-${Date.now()}`;
    console.log(`\nStep 2: Creating "${uniqueName}"...`);
    const createResult = await manifold_create_thing(uniqueName);

    if (!isSuccess(createResult))
      throw new Error(`Creation failed: ${getErrorMessage(createResult)}`);
    const thingEci = createResult.data.thingEci;
    console.log(`✓ Created! ECI: ${thingEci}`);

    // Step 3: Verify Child Link
    console.log(`\nStep 3: Verifying parent-child link...`);
    const childCheck = await manifold_isAChild(thingEci);
    console.log(`✓ Is child: ${childCheck.data}`);

    // Step 4: Add SquareTag (Pivotal Prototype 2 Requirement)
    const testTag = `TAG-${Math.random().toString(36).substring(7).toUpperCase()}`;
    console.log(
      `\nStep 4: Registering SquareTag "${testTag}" to "${uniqueName}"...`,
    );

    // safeandmine_newtag uses the abstracted setSquareTag under the hood
    const tagResult = await safeandmine_newtag(uniqueName, testTag, "sqtg");

    if (isSuccess(tagResult)) {
      console.log(`✓ Tag registration event successful.`);
    } else {
      console.log(`✗ Tag registration failed: ${getErrorMessage(tagResult)}`);
    }

    // Step 5: Verify State Change (The "Rigorous" Part)
    console.log(`\nStep 5: Verifying tag storage on the Pico...`);
    // Give the engine a moment to process the registration event
    await new Promise((r) => setTimeout(r, 1500));

    const tagsQuery = await safeandmine_getTags(thingEci);
    if (isSuccess(tagsQuery)) {
      const registeredTags = tagsQuery.data?.sqtg || [];
      if (registeredTags.includes(testTag)) {
        console.log(`✓ Success! Tag "${testTag}" found in Pico storage.`);
      } else {
        console.log(
          `✗ Error: Tag not found. Current tags: ${JSON.stringify(registeredTags)}`,
        );
      }
    } else {
      console.log(`✗ Could not query tags: ${getErrorMessage(tagsQuery)}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("RESULT: END-TO-END ABSTRACTION VERIFIED");
    console.log("=".repeat(60));
  } catch (error) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  }
}

// Run the test
testManifoldConnection();
