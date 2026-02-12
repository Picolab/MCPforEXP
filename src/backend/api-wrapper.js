const path = require("path");
const { pathToFileURL } = require("url");
const {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  picoHasRuleset,
  installRuleset,
  getECIByTag,
  getChildEciByName,
  sendAPICall,
} = require("./utility.js");

async function main() {
  const rootECI = await getRootECI();
  console.log("ROOTECI: ", rootECI);
  const ownerECI = await getChildEciByName(rootECI, "Owner");
  console.log("OWNERECI: ", ownerECI);
  const ownerInitializationECI = await getInitializationECI(ownerECI);
  console.log("OWNERINITIALIZATION: ", ownerInitializationECI);
  const manifoldECI = await getManifoldECI(ownerInitializationECI);
  return manifoldECI;
  //console.log(manifoldECI);
}

if (require.main === module) {
  main();
}

/**
 * Retrieves a detailed map of all "Things" managed by a specific Manifold Pico.
 * @async
 * @function listThings
 * @param {string} manifold_eci - The ECI of the Manifold Pico to query.
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
async function listThings(manifold_eci) {
  try {
    const requestEndpoint = `/c/${manifold_eci}/query/io.picolabs.manifold_pico/getThings`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
  } catch (error) {
    console.error("Error in listThings:", error);
  }
}

/**
 * Triggers the creation of a new "Thing" Pico within the Manifold system.
 * Uses an event-wait pattern and polls for discovery by name.
 * @async
 * @function createThing
 * @param {string} manifoldEci - The ECI of the Manifold Pico.
 * @param {string} thingName - The display name for the new child Pico.
 * @returns {Promise<string>} The ECI of the newly created Thing.
 * @throws {Error} If the timeout (10s) is reached before the Pico appears in the engine.
 */
async function createThing(manifoldEci, thingName) {
  //const url = `http://localhost:3000/c/${manifoldEci}/event-wait/manifold/create_thing`;

  try {
    const requestEndpoint = `/c/${manifoldEci}/event-wait/manifold/create_thing`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: thingName }),
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
    for (let i = 0; i < 10; i++) {
      const thingEci = await getChildEciByName(manifoldEci, thingName);
      if (thingEci) {
        console.log(thingEci);
        return thingEci;
      }
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (error) {
    console.error(`Error in createThing:`, error.message);
    throw error;
  }
}

/**
 * @param {*} eci - The ECI that you want to add the journal krl to (if not already). And the ECI that will have a note added to.
 * @param {*} title - The title of the note
 * @param {*} content - The content of the note
 *
 * This function first checks to see if the jounal krl is installed, if not it installs it.
 * It then sends a message to the event-wait/journal/new_entry endpoint for the chosen ECI.
 */
async function addNote(krlPath, eci, title, content) {
  try {
    const rid = "io.picolabs.journal";
    const isInstalled = await picoHasRuleset(eci, rid);

    if (!isInstalled) {
      console.log("Installing journal...");
      const absolutePath = path.join(
        __dirname,
        `../../Manifold-api/${rid}.krl`,
      );
      await installRuleset(eci, pathToFileURL(absolutePath).href);
      await new Promise((r) => setTimeout(r, 10000));
    }

    // Send API request

    const requestEndpoint = `/c/${eci}/event-wait/journal/new_entry`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, content: content }),
    };
    const data = await sendAPICall(requestEndpoint, requestBody);
    console.log("Data is", data);
  } catch (err) {
    console.error("Error in addNote:", err);
    throw err;
  }
}

async function getNote(eci, title) {
  try {
    const rid = "io.picolabs.journal";
    const isInstalled = await picoHasRuleset(eci, rid);

    if (!isInstalled) {
      // If trying to get note and this isn't installed then there's no point in installing it to get a note. It's impossible.
      throw new Error("Error in getNote: journal ruleset not installed.");
    }

    const requestEndpoint = `/c/${eci}/event-wait/journal/get_entry`; // This is just a guess, I'll fill it in for real in a minute.
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title }),
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
    console.log("Data is", data);
  } catch (err) {
    console.error("Error in getNote: ", err);
    throw err;
  }
}

/**
 * Registers a SquareTag for a specific Thing.
 * Automatically ensures the 'safeandmine' ruleset is installed on the Thing before registration.
 * @async
 * @function setSquareTag
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {string} tagId - The unique identifier for the physical tag.
 * @param {string} [domain="sqtg"] - The namespace for the tag (default: "sqtg").
 * @returns {Promise<Object>} The engine's event response containing the event ID.
 * @throws {Error} If ruleset installation or tag registration fails.
 */
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

    const requestEndpoint = `/c/${manifoldECI}/event/safeandmine/new_tag`;
    const requestbody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagID: tagId, domain: domain }),
    };

    const data = await sendAPICall(requestEndpoint, requestBody);

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
    const rootECI = await getRootECI();
    const tagRegistryECI = await getChildEciByName(rootECI, "Tag Registry");
    const registrationECI = await getECIByTag(tagRegistryECI, "registration");

    const requestEndpoint = `/c/${registrationECI}/query/io.picolabs.new_tag_registry/scan_tag`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagID: tagId, domain: domain }),
    };

    const scanTagData = await sendAPICall(requestEndpoint, requestBody);
    const tagECI = scanTagData.did;

    const infoRequestEndpoint = `/c/${tagECI}/query/io.picolabs.safeandmine/getInformation`;
    const infoRequestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ info: "" }),
    };

    const infoData = await sendAPICall(infoRequestEndpoint, infoRequestBody);

    return infoData;
  } catch (err) {
    console.error("scanTag error: ", err);
  }
}

module.exports = {
  main,
  listThings,
  createThing,
  addNote,
  getNote,
  setSquareTag,
  scanTag,
};
