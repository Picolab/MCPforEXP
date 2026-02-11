const path = require("path");
const { pathToFileURL } = require("url");
const {
  getRootECI,
  picoHasRuleset,
  getECIByTag,
  getChildEciByName,
  traverseHierarchy,
} = require("./utility.js");

async function main() {
  console.log(await traverseHierarchy());
}

if (require.main === module) {
  main();
}

/**
 * Automatically determines the Manifold Pico and retrieves a detailed map of all it's "Things".
 * @async
 * @function listThings
 * @returns {Promise<Object<string, Object>>} A map where keys are Pico IDs and values are metadata objects:
 * {
    "{picoID}": {
      "Rx_role": manifold pico's subscription role,
      "Tx_role": thing's subscription role,
      "Id": ID of the manifold-thing subscription,
      "Tx": manifold's subscription ECI,
      "Rx": thing's subscription ECI,
      "name": user-input name string,
      "subID": ID of the manifold-thing subscription,
      "picoID": thing's #system #self ECI,
      "color": color in the pico-engine UI
      },
 * }
 * @throws {Error} If the engine query fails.
 */
async function listThings() {
  try {
    //Get the manifold channel ECI by traversing the pico hierarchy
    const manifold_eci = await traverseHierarchy();

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
 * Triggers the creation of a new "Thing" Pico within the Manifold system.
 * Uses an event-wait pattern and polls for discovery by name.
 * @async
 * @function createThing
 * @param {string} thingName - The display name for the new child Pico.
 * @returns {Promise<string>} The ECI of the newly created Thing.
 * @throws {Error} If the timeout (10s) is reached before the Pico appears in the engine.
 */
async function createThing(thingName) {
  const manifoldEci = await traverseHierarchy();
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

    for (let i = 0; i < 10; i++) {
      const thingEci = await getChildEciByName(manifoldEci, thingName);
      if (thingEci) {
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

/**
 * Deletes a Thing Pico by name. Uses the same event as manifold_remove_thing, but with an event-wait pattern to ensure completion before returning.
 * @async
 * @function deleteThing
 * @param {string} thingName - The name of the Thing Pico to delete.
 * @returns {Promise<Object>} The engine's event response.
 * @throws {Error} If the timeout (10s) is reached before the Pico is removed from the engine.
 */
async function deleteThing(thingName) {
  const manifoldEci = await traverseHierarchy();
  const thingEci = await getChildEciByName(manifoldEci, thingName);
  if (!thingEci) throw new Error(`Thing "${thingName}" not found.`);
  // Use your manifold domain to ensure KRL cleanup happens!
  const url = `http://localhost:3000/c/${manifoldEci}/event-wait/manifold/remove_thing`;

  try {
    const thingPicoId = await fetch(`
http://localhost:3000/c/${thingEci}/query/io.picolabs.wrangler/myself`);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picoID: thingPicoId }), // Make sure this is the ID, not an ECI
    });

    if (!response.ok) throw new Error(`HTTP Error (${response.status})`);

    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error(`Error in deleteThing:`, error.message);
    throw error;
  }
}

// addNote(eci, title, content)
async function addNote(eci, title, content) {}

/**
 * Registers a SquareTag for a specific Thing.
 * Automatically ensures the 'safeandmine' ruleset is installed on the Thing before registration.
 * @async
 * @function setSquareTag
 * @param {string} thingName - The name of the Thing Pico.
 * @param {string} tagId - The unique identifier for the physical tag.
 * @param {string} [domain="sqtg"] - The namespace for the tag (default: "sqtg").
 * @returns {Promise<Object>} The engine's event response containing the event ID.
 * @throws {Error} If ruleset installation or tag registration fails.
 */
async function setSquareTag(thingName, tagId, domain = "sqtg") {
  try {
    // Get eci of Thing pico
    const manifoldEci = await traverseHierarchy();
    const thingEci = await getChildEciByName(manifoldEci, thingName);

    const rid = "io.picolabs.safeandmine";
    const isInstalled = await picoHasRuleset(thingEci, rid);

    if (!isInstalled) {
      console.log("Installing safeandmine...");
      const absolutePath = path.join(
        __dirname,
        `../../Manifold-api/${rid}.krl`,
      );
      await installRuleset(thingEci, pathToFileURL(absolutePath).href);
      await new Promise((r) => setTimeout(r, 1000)); // Give KRL time to init
    }

    const thingManifoldChannel = await getECIByTag(thingEci, "manifold");

    const response = await fetch(
      `http://127.0.0.1:3000/c/${thingManifoldChannel}/event/safeandmine/new_tag`,
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

/**
 * Gets owner info from a given tag
 *
 * @param {string} tagId
 * @param {string} [domain=sqtg]
 *
 * @returns {object} JSON with owner data:
 * {
 *  name: string,
 *  email: string,
 *  phone: string,
 *  message: string,
 *  shareName: bool,
 *  sharePhone: bool,
 *  shareEmail: bool
 * }
 */
async function scanTag(tagId, domain = "sqtg") {
  try {
    const rootECI = getRootECI();
    const tagRegistryECI = getChildEciByName(rootECI, "Tag Registry");
    const registrationECI = getECIByTag(tagRegistryECI, "registration");

    const scanTagResponse = await fetch(
      `http://localhost:3000/c/${registrationECI}/query/io.picolabs.new_tag_registry/scan_tag`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagID: tagId, domain: domain }),
      },
    );

    const scanTagData = await scanTagResponse.json();
    const tagECI = scanTagData.did;

    const infoResponse = await fetch(
      `http://localhost:3000/c/${tagECI}/query/io.picolabs.safeandmine/getInformation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info: "" }),
      },
    );

    const infoData = await infoResponse.json();

    return infoData;
  } catch (err) {
    console.error("scanTag error: ", err);
  }
}

/**
 * Updates a thing's owner info from an object that defines which attributes should be updated
 *
 * @param {string} thingName
 * @param {object} ownerInfo
 * {
 *  name?: string,
 *  email?: string,
 *  phone?: string,
 *  message?: string,
 *  shareName?: bool,
 *  sharePhone?: bool,
 *  shareEmail?: bool
 * }
 *
 * @returns {Promise<Object>} The engine's event response containing the event ID.
 * @throws {Error} If info query or update fails.
 */
async function updateOwnerInfo(thingName, ownerInfo) {
  try {
    const manifoldEci = await traverseHierarchy();
    const thingEci = await getChildEciByName(manifoldEci, thingName);
    const validChannel = await getECIByTag(thingEci, "manifold");

    const infoResponse = await fetch(
      `http://localhost:3000/c/${validChannel}/query/io.picolabs.safeandmine/getInformation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info: "" }),
      },
    );
    let currentOwnerInfo = await infoResponse.json();

    // Accounts for case of object not having any owner info yet
    if (Object.keys(currentOwnerInfo) == 0) {
      currentOwnerInfo = {
        name: "",
        email: "",
        phone: "",
        message: "",
        shareName: false,
        sharePhone: false,
        shareEmail: false,
      };
    }

    // Loop through info attributes. Anything that is not defined by ownerInfo is not being updated and should retain its current value.
    let newOwnerInfo = {};
    for (const [key] of Object.entries(currentOwnerInfo)) {
      if (ownerInfo[key] === undefined) {
        newOwnerInfo[key] = currentOwnerInfo[key];
      } else {
        newOwnerInfo[key] = ownerInfo[key];
      }
    }

    const updateResponse = await fetch(
      `http://localhost:3000/c/${validChannel}/event-wait/safeandmine/update`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOwnerInfo),
      },
    );

    const updateData = await updateResponse.json();
    return updateData;
  } catch (err) {
    console.error("updateOwnerInfo error: ", err);
  }
}

module.exports = {
  main,
  listThings,
  createThing,
  addNote,
  setSquareTag,
  scanTag,
  updateOwnerInfo,
  deleteThing,
};
