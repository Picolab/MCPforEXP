const path = require("path");
const { pathToFileURL } = require("url");
const {
  getRootECI,
  picoHasRuleset,
  getECIByTag,
  getChildEciByName,
  traverseHierarchy,
  installRuleset,
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
 * @param {*} eci - The eci of the object of the thing in manifold (the thing with the journal app)
 * @param {*} title - The title of the note that is being attached
 * @param {*} content - The content of the note attached to the title
 *
 * This function, given the eci of the object, the title and the content attaches said note to an object.
 * Before it can attach the note, however, it needs to make sure that the journal app is installed.
 * If it's not installed, it tries to add the journal app.
 */
async function addNote(eci, title, content) {
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
    const response = await fetch(
      `http://localhost:3000/c/${eci}/event-wait/journal/new_entry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, content: content }),
      },
    );
    const data = await response.json();
    console.log("Data is", data);
  } catch (err) {
    console.error("Error in addNote:", err);
    throw err;
  }
}

/**
 * @param {*} eci - The eci of the object of the thing in manifold (the thing with the journal app)
 * @param {*} title - The title of the note that is being attached
 *
 * This function, given the title of the note returns the note with that title.
 */

async function getNote(eci, title) {
  try {
    const rid = "io.picolabs.journal";
    const isInstalled = await picoHasRuleset(eci, rid);

    if (!isInstalled) {
      // If trying to get note and this isn't installed then there's no point in installing it to get a note. It's impossible.
      throw new Error("Error in getNote: journal ruleset not installed.");
    }

    const response = await fetch(
      `http://localhost:3000/c/${eci}/event-wait/journal/getEntry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title }),
      },
    );

    const data = await response.json();
    console.log("Data is", data);
  } catch (err) {
    console.error("Error in getNote: ", err);
    throw err;
  }
}

/**
 * Helper function to get a thing's manifold channel ECI by thing name.
 * @async
 * @param {string} thingName - The name of the Thing Pico.
 * @returns {Promise<string>} The manifold channel ECI for the thing.
 */
async function getThingManifoldChannel(thingName) {
  const manifoldEci = await traverseHierarchy();
  const thingEci = await getChildEciByName(manifoldEci, thingName);
  if (!thingEci) {
    throw new Error(`Thing "${thingName}" not found`);
  }
  return await getECIByTag(thingEci, "manifold");
}

/**
 * Resolves a thing name to its picoID using the list of things from the manifold.
 * @async
 * @param {string} thingName - The name of the Thing Pico.
 * @returns {Promise<string>} The picoID (ECI) of the thing.
 */
async function getPicoIDByName(thingName) {
  const things = await listThings();
  for (const [picoID, thingData] of Object.entries(things)) {
    if (thingData.name === thingName) {
      return picoID;
    }
  }
  throw new Error(`Thing "${thingName}" not found`);
}

/**
 * Checks if a thing with the given name is a registered child of the Manifold.
 * @async
 * @param {string} thingName - The name of the thing to verify.
 * @returns {Promise<boolean>} True if the thing is a child, false otherwise.
 */
async function manifold_isAChild(thingName) {
  const picoID = await getPicoIDByName(thingName);
  const eci = await traverseHierarchy();
  const response = await fetch(
    `http://localhost:3000/c/${eci}/query/io.picolabs.manifold_pico/isAChild`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picoID }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }

  return await response.json();
}

/**
 * Removes a Thing Pico by picoID (internal use).
 * @async
 * @param {string} picoID - The ID of the Thing Pico to remove.
 * @returns {Promise<Object>} The engine's event response.
 */
async function manifold_remove_thing(picoID) {
  const eci = await traverseHierarchy();
  const response = await fetch(
    `http://localhost:3000/c/${eci}/event/manifold/remove_thing`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picoID }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }

  return await response.json();
}

/**
 * Updates the display name of an existing Thing Pico (by thing name).
 * @async
 * @param {string} thingName - The current name of the Thing.
 * @param {string} changedName - The new name for the Thing.
 * @returns {Promise<Object>} The engine's event response.
 */
async function manifold_change_thing_name(thingName, changedName) {
  const picoID = await getPicoIDByName(thingName);
  const eci = await traverseHierarchy();
  const response = await fetch(
    `http://localhost:3000/c/${eci}/event/manifold/change_thing_name`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ picoID, changedName }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }

  return await response.json();
}

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

/**
 * Removes a Thing Pico by its name (finds the picoID from the name).
 * @async
 * @param {string} thingName - The name of the Thing Pico to remove.
 * @returns {Promise<Object>} The engine's event response.
 */
async function removeThingByName(thingName) {
  const picoID = await getPicoIDByName(thingName);
  return await manifold_remove_thing(picoID);
}

module.exports = {
  main,
  listThings,
  createThing,
  addNote,
  getNote,
  setSquareTag,
  scanTag,
  updateOwnerInfo,
  manifold_isAChild,
  manifold_remove_thing,
  manifold_change_thing_name,
  removeThingByName,
  getPicoIDByName,
};
