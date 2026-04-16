const path = require("path");
const { pathToFileURL } = require("url");
const {
  getRootECI,
  getECIByTag,
  getChildEciByName,
  traverseHierarchy,
  getCommunityEciByName,
} = require("./utility/eci-utility.js");
const { picoHasRuleset, installRuleset } = require("./utility/api-utility.js");
const { postFetchRequest } = require("./utility/http-utility.js");

/**
 * PICO ENGINE COMMUNICATION STRATEGY:
 * We do not use hardcoded ECIs (Event Channel Identifiers) because Picos
 * are dynamic and their ECIs can change if they are recreated or moved.
 * * THE PATTERN:
 * 1. Traverse the hierarchy from the Root Pico to find the Manifold Pico.
 * 2. Use that discovered ECI to query the state of the system.
 */

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

    const requestEndpoint = `/c/${manifold_eci}/query/io.picolabs.manifold_pico/getThings`;
    const response = await postFetchRequest(requestEndpoint, {});

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data || {};
  } catch (error) {
    console.error("Fetch error:", error);
    return {};
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
  //Check if thingName already exists in manifold. If so, throw error to avoid duplicates.
  const thingsResult = await listThings();
  const things = thingsResult || {}; // Fallback to empty object if null/undefined

  for (const [picoID, thingData] of Object.entries(things)) {
    if (thingData && thingData.name === thingName) {
      throw new Error(`Thing with name "${thingName}" already exists`);
    }
  }

  const manifoldEci = await traverseHierarchy();
  /*if (!manifoldEci) {
    throw new Error("Could not find Manifold ECI. TraverseHierarchy failed.");
  }*/

  console.log("traverseHierarchy result in createThing:", manifoldEci);

  // We use the '/event-wait/' endpoint here.
  /**
   * KRL LAYER: event-wait
   * Standard '/event/' is fire-and-forget. Because Pico creation and ruleset
   * installation are asynchronous and involve multiple rules firing in sequence,
   * we use 'event-wait' to ensure the engine finishes processing the primary
   * event before we begin our discovery polling loop.
   */
  const requestEndpoint = `/c/${manifoldEci}/event-wait/manifold/create_thing`;

  try {
    const response = await postFetchRequest(requestEndpoint, {
      name: thingName,
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
 * @async
 * @function addNote
 * @param {*} thingName - The name of the thing in manifold (the thing with the journal app)
 * @param {*} title - The title of the note that is being attached
 * @param {*} content - The content of the note attached to the title
 *
 * This function, given the name of the thing, the title and the content attaches said note to an object.
 * Before it can attach the note, however, it needs to make sure that the journal app is installed.
 * If it's not installed, it tries to add the journal app.
 */
async function addNote(thingName, title, content) {
  try {
    const manifoldEci = await traverseHierarchy();
    const engineEci = await getChildEciByName(manifoldEci, thingName);
    const thingEci = await getECIByTag(engineEci, "manifold");

    const rid = "io.picolabs.journal";
    const isInstalled = await picoHasRuleset(engineEci, rid);

    if (!isInstalled) {
      console.log("Installing journal...");
      const absolutePath = path.join(
        __dirname,
        `../../Manifold-api/${rid}.krl`,
      );
      await installRuleset(engineEci, pathToFileURL(absolutePath).href);
      await new Promise((r) => setTimeout(r, 10000));
    }

    const requestEndpoint = `/c/${thingEci}/event-wait/journal/new_entry`;

    // Send API Request
    const response = await postFetchRequest(requestEndpoint, {
      title: title,
      content: content,
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error in addNote:", err);
    throw err;
  }
}

/**
 * @async
 * @function getNote
 * @param {*} thingName - The name of the thing in manifold (the thing with the journal app)
 * @param {*} title - The title of the note that is being attached
 *
 * Given the name of the thing and the title of the note returns the note with that title.
 */
async function getNote(thingName, title) {
  try {
    const manifoldEci = await traverseHierarchy();
    const engineEci = await getChildEciByName(manifoldEci, thingName);
    const thingEci = await getECIByTag(engineEci, "manifold");

    const rid = "io.picolabs.journal";
    const isInstalled = await picoHasRuleset(engineEci, rid);

    if (!isInstalled) {
      // If trying to get note and this isn't installed then there's no point in installing it to get a note. It's impossible.
      throw new Error("Error in getNote: journal ruleset not installed.");
    }

    const requestEndpoint = `/c/${thingEci}/query/io.picolabs.journal/getEntry`;

    const response = await postFetchRequest(requestEndpoint, { title: title });

    if (!response.ok) {
      throw new Error(
        `HTTP Error (${response.status}): ${await response.text()}`,
      );
    }

    const data = await response.json();
    console.log("Data is", data);
    return data;
  } catch (err) {
    console.error("Error in getNote: ", err);
    throw err;
  }
}

/**
 * Install a logical Skill on a Thing by installing its backing KRL ruleset.
 *
 * Supported skills:
 * - "journal"    -> io.picolabs.journal   (installed on the Thing's engine UI pico)
 * - "safeandmine"-> io.picolabs.safeandmine (installed on the Thing pico itself)
 *
 * @param {string} thingName
 * @param {string} skillName
 * @returns {Promise<object>} Installation result metadata
 */
async function installSkillForThing(thingName, skillName) {
  const SKILL_MAP = {
    journal: {
      rid: "io.picolabs.journal",
      installOn: "engine", // use the engine/UI pico for this Thing
    },
    safeandmine: {
      rid: "io.picolabs.safeandmine",
      installOn: "thing", // use the Thing pico itself
    },
  };

  const skillDef = SKILL_MAP[skillName];
  if (!skillDef) {
    throw new Error(
      `Unknown Skill "${skillName}". Supported Skills are: ${Object.keys(SKILL_MAP).join(", ")}`,
    );
  }

  const manifoldEci = await traverseHierarchy();
  const engineEci = await getChildEciByName(manifoldEci, thingName);
  if (!engineEci) {
    throw new Error(`Thing "${thingName}" not found`);
  }

  const targetEci = skillDef.installOn === "engine" ? engineEci : engineEci; // currently both use the child pico ECI

  const alreadyInstalled = await picoHasRuleset(targetEci, skillDef.rid);
  if (alreadyInstalled) {
    return {
      thingName,
      skill: skillName,
      rid: skillDef.rid,
      installed: false,
      message: "Skill already installed.",
    };
  }

  const absolutePath = path.join(
    __dirname,
    `../../Manifold-api/${skillDef.rid}.krl`,
  );
  await installRuleset(targetEci, pathToFileURL(absolutePath).href);

  // Give the ruleset a brief moment to initialize
  await new Promise((r) => setTimeout(r, 2000));

  return {
    thingName,
    skill: skillName,
    rid: skillDef.rid,
    installed: true,
    message: "Skill installation triggered.",
  };
}

/**
 * Derive a Thing's installed Skills from its installed KRL rulesets.
 *
 * Skill mapping (current project conventions):
 * - "manifold_core": always available for Manifold things
 * - "safeandmine": provided by ruleset rid "io.picolabs.safeandmine"
 * - "journal": provided by ruleset rid "io.picolabs.journal"
 *
 * @param {string} thingName
 * @returns {Promise<string[]>} skill names
 */
async function getThingSkills(thingName) {
  const skills = ["manifold_core"];
  const manifoldEci = await traverseHierarchy();
  const thingEci = await getChildEciByName(manifoldEci, thingName);
  if (!thingEci) {
    throw new Error(`Thing "${thingName}" not found`);
  }

  // Safe & Mine is expected to be installed on all things, but we still check for correctness.
  if (await picoHasRuleset(thingEci, "io.picolabs.safeandmine")) {
    skills.push("safeandmine");
  }

  if (await picoHasRuleset(thingEci, "io.picolabs.journal")) {
    skills.push("journal");
  }

  return skills;
}

/**
 * Removes a Thing Pico by it's name.
 * @async
 * @function deleteThing
 * @param {string} thingName - The name of the Thing Pico to remove.
 * @returns {Promise<Object>} The engine's event response.
 * @throws {Error} If the thing is not found or if the engine request fails.
 */
async function deleteThing(thingName) {
  const picoID = await getPicoIDByName(thingName);

  const eci = await traverseHierarchy();
  const requestEndpoint = `/c/${eci}/event/manifold/remove_thing`;
  const response = await postFetchRequest(requestEndpoint, { picoID });

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
 * @function manifold_change_thing_name
 * @param {string} thingName - The current name of the Thing.
 * @param {string} changedName - The new name for the Thing.
 * @returns {Promise<Object>} The engine's event response.
 * @throws {Error} If the thing is not found or if the engine request fails.
 */
async function manifold_change_thing_name(thingName, changedName) {
  const picoID = await getPicoIDByName(thingName);
  const eci = await traverseHierarchy();

  const requestEndpoint = `/c/${eci}/event/manifold/change_thing_name`;
  const response = await postFetchRequest(requestEndpoint, {
    picoID,
    changedName,
  });

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
async function setSquareTag(thingName, tagId, domain) {
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

    const requestEndpoint = `/c/${thingManifoldChannel}/event/safeandmine/new_tag`;
    const response = await postFetchRequest(requestEndpoint, {
      tagID: tagId,
      domain: domain,
    });

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
 * @async
 * @function scanTag
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
async function scanTag(tagId, domain) {
  try {
    /**
     * HIERARCHY TRAVERSAL:
     * To find tag info, we must navigate the Pico tree:
     * Root Pico -> Tag Registry Pico -> Registration Channel.
     * This demonstrates the "Discovery" aspect of an ECI—instead of
     * storing a static ID, we find the actor responsible for the data.
     */
    const rootECI = await getRootECI();
    console.log("Root ECI:", rootECI);
    const tagRegistryECI = await getChildEciByName(rootECI, "Tag Registry");
    console.log("Tag Registry ECI:", tagRegistryECI);
    const registrationECI = await getECIByTag(tagRegistryECI, "registration");
    console.log("Tag Registration Channel ECI:", registrationECI);

    const requestEndpoint = `/c/${registrationECI}/query/io.picolabs.new_tag_registry/scan_tag`;
    const scanTagResponse = await postFetchRequest(requestEndpoint, {
      tagID: tagId,
      domain: domain,
    });

    if (!scanTagResponse.ok) {
      throw new Error(
        `HTTP Error (${scanTagResponse.status}): ${await scanTagResponse.text()}`,
      );
    }

    const scanTagData = await scanTagResponse.json();
    console.log("scanTagData:", scanTagData);
    const tagECI = scanTagData.did;

    const infoRequestEndpoint = `/c/${tagECI}/query/io.picolabs.safeandmine/getInformation`;
    const infoResponse = await postFetchRequest(infoRequestEndpoint, {
      info: "",
    });

    if (!infoResponse.ok) {
      throw new Error(
        `HTTP Error (${infoResponse.status}): ${await infoResponse.text()}`,
      );
    }

    const infoData = await infoResponse.json();

    return infoData;
  } catch (err) {
    console.error("scanTag error: ", err);
  }
}

/**
 * Updates a thing's owner info from an object that defines which attributes should be updated
 * @async
 * @function updateOwnerInfo
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

    const requestEndpoint = `/c/${validChannel}/query/io.picolabs.safeandmine/getInformation`;
    const infoResponse = await postFetchRequest(requestEndpoint, { info: "" });

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

    const updateRequestEndpoint = `/c/${validChannel}/event-wait/safeandmine/update`;
    const updateResponse = await postFetchRequest(
      updateRequestEndpoint,
      newOwnerInfo,
    );

    const updateData = await updateResponse.json();
    return updateData;
  } catch (err) {
    console.error("updateOwnerInfo error: ", err);
  }
}

/**
 * Resolves a thing name to its picoID using the list of things from the manifold.
 * @async
 * @function getPicoIDByName
 * @param {string} thingName - The name of the Thing Pico.
 * @returns {Promise<string>} The picoID (ECI) of the thing.
 * @throws {Error} If the thing is not found in the list of things.
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
 * Automatically determines the Manifold Pico and retrieves a detailed map of all it's "Communities".
 * @async
 * @function listCommunities
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
    }
 * }
 * @throws {Error} If the engine query fails.
 */
async function listCommunities() {
  try {
    //Get the manifold channel ECI by traversing the pico hierarchy
    const manifold_eci = await traverseHierarchy();

    const requestEndpoint = `/c/${manifold_eci}/query/io.picolabs.manifold_pico/getCommunities`;
    const response = await postFetchRequest(requestEndpoint, {});

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data || {};
  } catch (error) {
    console.error("Fetch error:", error);
    return {};
  }
}

/**
 * Triggers the creation of a new "Community" Pico within the Manifold system.
 * Uses an event-wait pattern and polls for discovery by name.
 * @async
 * @function createCommunity
 * @param {string} communityName - The display name for the new community.
 * @param {string} description - The description for the new community.
 * @returns {Promise<string>} The ECI of the newly created Community.
 * @throws {Error} If the timeout (10s) is reached before the Pico appears in the engine.
 */
async function createCommunity(communityName, description) {
  //Check if communityName already exists in manifold. If so, throw error to avoid duplicates.
  const communitiesResult = await listCommunities();
  const communities = communitiesResult || {}; // Fallback to empty object if null/undefined

  for (const [picoID, communityData] of Object.entries(communities)) {
    if (communityData && communityData.name === communityData) {
      throw new Error(`Thing with name "${communityName}" already exists`);
    }
  }

  const manifoldEci = await traverseHierarchy();
  /*if (!manifoldEci) {
    throw new Error("Could not find Manifold ECI. TraverseHierarchy failed.");
  }*/

  console.log("traverseHierarchy result in createCommunity:", manifoldEci);
  const requestEndpoint = `/c/${manifoldEci}/event-wait/manifold/new_community`;

  try {
    const response = await postFetchRequest(requestEndpoint, {
      name: communityName,
      description: description,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP Error (${response.status}): ${await response.text()}`,
      );
    }

    const data = await response.json();

    for (let i = 0; i < 10; i++) {
      const communityEci = await getCommunityIDByName(communityName);
      if (communityEci) {
        console.log(communityEci);
        return communityEci;
      }
      process.stdout.write(".");
      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(`Timed out waiting for Pico "${communityName}" to appear.`);
  } catch (error) {
    console.error(`Error in createCommunity:`, error.message);
    throw error;
  }
}

/**
 * @async
 * @function addThingToCommunity
 * @param {string} thingName - The name of the thing in manifold
 * @param {string} communityName - The name of the community in manifold
 *
 * This function, given the name of the thing being attached and the community to attach it to, attaches the thing to the community.
 */
async function addThingToCommunity(thingName, communityName) {
  try {
    const manifoldEci = await traverseHierarchy();
    const picoID = await getPicoIDByName(thingName);
    const communityID = await getCommunityIDByName(communityName);

    const requestEndpoint = `/c/${manifoldEci}/event-wait/manifold/add_thing_to_community`;

    // Send API Request
    const response = await postFetchRequest(requestEndpoint, {
      communityPicoID: communityID,
      thingPicoID: picoID,
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error in addThingToCommunity:", err);
    throw err;
  }
}

/**
 * @async
 * @function listThingsFromCommunity
 * @param {string} communityName - The name of the community in the manifold.
 */
async function listThingsFromCommunity(communityName) {
  try {
    const manifoldEci = await traverseHierarchy();
    const engineEci = await getCommunityEciByName(manifoldEci, communityName);
    const communityEci = await getECIByTag(engineEci, "manifold");

    //const communityID = await getCommunityIDByName(communityName);

    const requestEndpoint = `/c/${communityEci}/query/io.picolabs.community/things`;

    // Send API Request
    const response = await postFetchRequest(requestEndpoint, {});
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error in listThingsFromCommunity:", err);
    throw err;
  }
}

/**
 * @async
 * @function getCommunityDescription
 * @param {string} communityName - The name of the community in the manifold.
 */
async function getCommunityDescription(communityName) {
  try {
    const manifoldEci = await traverseHierarchy();
    const engineEci = await getCommunityEciByName(manifoldEci, communityName);
    const communityEci = await getECIByTag(engineEci, "manifold");

    //const communityID = await getCommunityIDByName(communityName);

    const requestEndpoint = `/c/${communityEci}/query/io.picolabs.community/description`;

    // Send API Request
    const response = await postFetchRequest(requestEndpoint, {});
    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Error in getCommunityDescription:", err);
    throw err;
  }
}

/**
 * Removes a Community Pico by its name.
 * @async
 * @function deleteCommunity
 * @param {string} communityName - The name of the Community Pico to remove.
 * @returns {Promise<Object>} The engine's event response.
 * @throws {Error} If the community is not found or if the engine request fails.
 */
async function deleteCommunity(communityName) {
  const picoID = await getPicoIDByName(communityName);

  const eci = await traverseHierarchy();
  const requestEndpoint = `/c/${eci}/event-wait/manifold/remove_community`;
  const response = await postFetchRequest(requestEndpoint, { picoID });

  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }

  return await response.json();
}

/**
 * Resolves a community name to its picoID using the list of communities from the manifold.
 * @async
 * @function getCommunityIDByName
 * @param {string} communityName - The name of the Community Pico.
 * @returns {Promise<string>} The picoID (ECI) of the thing.
 * @throws {Error} If the community is not found in the list of communities.
 */
async function getCommunityIDByName(communityName) {
  const communities = await listCommunities();
  for (const [picoID, communityData] of Object.entries(communities)) {
    if (communityData.name === communityName) {
      return picoID;
    }
  }
  throw new Error(`Community "${communityName}" not found`);
}

module.exports = {
  main,
  listThings,
  createThing,
  addNote,
  getNote,
  installSkillForThing,
  getThingSkills,
  setSquareTag,
  scanTag,
  updateOwnerInfo,
  deleteThing,
  manifold_change_thing_name,
  getPicoIDByName,
  listCommunities,
  createCommunity,
  addThingToCommunity,
  listThingsFromCommunity,
  getCommunityDescription,
  deleteCommunity,
  getCommunityIDByName,
};
