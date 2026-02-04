const path = require("path");
const { pathToFileURL } = require("url");

async function main() {
  const rootECI = await getRootECI();
  const ownerECI = await getChildEciByName(rootECI, "Owner");
  const ownerInitializationECI = await getInitializationECI(ownerECI);
  const manifoldECI = await getManifoldECI(ownerInitializationECI);
  console.log(manifoldECI);
}

if (require.main === module) {
  main();
}

/*
  listThings(manifold_eci)
  returns the manifold's things as the following JSON object:
  {
    "{picoID}": {
      "Rx_role": manifold pico's subscription role,
      "Tx_role": thing's subscription role,
      "Id": ID of the manifold-thing subscription,
      "Tx": manifold's subscription ECI,
      "Rx": thing's subscription ECI,
      "name": user-input name string,
      "subID": ID of the manifold-thing subscription,
      "picoID": thing's #system #self ECI,
      "color": color in the pico-engine UI,
      "picoId": thing's #system #self ECI
    },
    ...
  }
*/
async function listThings(manifold_eci) {
  try {
    const response = await fetch(
      `http://localhost:3000/c/${manifold_eci}/query/io.picolabs.manifold_pico/getThings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * createThing(manifoldEci, thingName)
 * Triggers the creation of a new Thing and waits for the engine to finish.
 */
async function createThing(manifoldEci, thingName) {
  // console.log(`Creating Thing: "${thingName}"...`);

  const url = `http://localhost:3000/c/${manifoldEci}/event-wait/manifold/create_thing`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: thingName }),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP Error (${response.status}): ${await response.text()}`,
      );
    }

    const data = await response.json();
    // console.log("Creation event accepted. Searching for new child Pico...");

    // Since the ECI isn't in the response, we poll for the child by name
    // Try for 10 seconds to give the engine time to finish initialization
    for (let i = 0; i < 10; i++) {
      const thingEci = await getChildEciByName(manifoldEci, thingName);
      if (thingEci) {
        //console.log(`✅ Thing "${thingName}" found! ECI: ${thingEci}`);
        console.log(thingEci);
        return thingEci;
      }
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(`Timed out waiting for Pico "${thingName}" to appear.`);
  } catch (error) {
    console.error(`Error in createThing:`, error.message);
    throw error;
  }
}

// addNote(eci, title, content)
async function addNote(eci, title, content) {}

// addTag(eci, tagID, domain)
async function addTag(eci, tagID, domain) {}

// listThingsByTag(eci, tag)
async function listThingsByTag(eci, tag) {}

// setSquareTag(eci, tagId, domain = "sqtg")
async function setSquareTag(eci, tagId, domain = "sqtg") {
  try {
    const rid = "io.picolabs.safeandmine";
    const isInstalled = await picoHasRuleset(eci, rid);

    if (!isInstalled) {
      console.log("Installing safeandmine...");
      const absolutePath = path.join(
        __dirname,
        `../../Manifold-api/${rid}.krl`,
      );
      await installRuleset(eci, pathToFileURL(absolutePath).href);
      await new Promise((r) => setTimeout(r, 1000)); // Give KRL time to init
    }

    const manifoldECI = await getECIByTag(eci, "manifold");

    const response = await fetch(
      `http://127.0.0.1:3000/c/${manifoldECI}/event/safeandmine/new_tag`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagID: tagId, domain: domain }),
      },
    );

    const data = await response.json();
    console.log("Done! Event id: ", data);

    return data;
  } catch (err) {
    console.error("Error in setSquareTag:", err);
    throw err;
  }
}

module.exports = {
  main,
  listThings,
  createThing,
  addNote,
  addTag,
  setSquareTag,
  listThingsByTag,
};
