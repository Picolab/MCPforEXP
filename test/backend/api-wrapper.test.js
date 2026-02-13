const { main, createThing } = require("../../src/backend/api-wrapper");
const { getChildEciByName, sendAPICall } = require("../../src/backend/utility");

let manifoldECI = "";

beforeAll(async () => {
  console.log("Started before all");
  manifoldECI = await main();
  console.log("MANIFOLD ECI: ", manifoldECI);
  await createThing(manifoldECI, "Blue Travel Case");
  console.log("Ended before all");
}, 60000);

describe("Integration Test: createThing", () => {
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
// We are going to change the thing to accept the url's from github.
// Most probably in a .env

// We want to run main

// Create the blue travel case
// Attach a note
// Get a note
