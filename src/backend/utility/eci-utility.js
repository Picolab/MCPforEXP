const { getFetchRequest } = require("./http-utility");

/**
 * Fetches the root ECI of the UI pico from the engine's local context.
 * * @async
 * @function getRootECI
 * @returns {Promise<string|undefined>} The ECI string for the root UI pico, or undefined if the fetch fails.
 * @throws {Error} If the response status is not OK.
 */
async function getRootECI() {
  try {
    const requestEndpoint = "/api/ui-context";
    const response = await getFetchRequest(requestEndpoint);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.eci;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * Searches the channels of a specific pico for one containing the "initialization" tag.
 * @async
 * @function getInitializationECI
 * @param {string} owner_eci - The ECI of the pico to search.
 * @returns {Promise<string>} The ECI of the initialization channel.
 * @throws {Error} If the channel is not found.
 */
async function getInitializationECI(owner_eci) {
  try {
    return await getECIByTag(owner_eci, "initialization");
  } catch (error) {
    console.error(
      `[getInitializationECI] Failed for ECI ${owner_eci}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Performs a deep search for a child pico by its display name.
 * * @async
 * @function getChildEciByName
 * @param {string} parentEci - The ECI of the parent pico.
 * @param {string} childName - The name string to match.
 * @returns {Promise<string|null>} The primary ECI of the child if found, otherwise null.
 * @throws {Error} If the parent pico cannot be queried.
 */
async function getChildEciByName(parentEci, childName) {
  try {
    const url = `http://127.0.0.1:3000/c/${parentEci}/query/io.picolabs.pico-engine-ui/pico`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to query parent: ${response.status}`);

    const data = await response.json();
    const childEcis = data.children || [];

    // We must query each child individually to find the one with the matching name
    for (const childEci of childEcis) {
      try {
        const nameUrl = `http://127.0.0.1:3000/c/${childEci}/query/io.picolabs.pico-engine-ui/name`;
        const nameResp = await fetch(nameUrl);

        if (nameResp.ok) {
          const actualName = await nameResp.json();
          if (actualName === childName) {
            return childEci; // Match found!
          }
        }
      } catch (err) {
        // Skip a specific child if it's currently unreachable/initializing
        continue;
      }
    }

    return null; // No match found after checking all children
  } catch (error) {
    console.error(
      `Error in getChildEciByName for "${childName}":`,
      error.message,
    );
    throw error;
  }
}

/**
 * Finds an ECI on a pico by searching for a specific channel tag.
 * * @async
 * @function getECIByTag
 * @param {string} owner_eci - The ECI of the pico to search.
 * @param {string} tag - The tag string to find (e.g., "manifold").
 * @returns {Promise<string|undefined>} The ID of the matching channel.
 * @throws {Error} If no channel with that tag exists.
 */
async function getECIByTag(owner_eci, tag) {
  try {
    const requestEndpoint = `/c/${owner_eci}/query/io.picolabs.pico-engine-ui/pico`;
    const response = await getFetchRequest(requestEndpoint);

    const data = await response.json();
    const channels = data.channels;

    for (let channel of channels) {
      if (channel.tags.includes(tag)) {
        return channel.id;
      }
    }
    throw new Error(`Child ECI with tag "${tag}" not found!`);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * Queries a manifold_owner pico to retrieve the ECI of its manifold child pico.
 * * @async
 * @function getManifoldECI
 * @param {string} owner_eci - A valid ECI for a manifold_owner pico.
 * @returns {Promise<string|undefined>} The ECI of the manifold child pico.
 */
async function getManifoldECI(owner_eci) {
  try {
    const response = await fetch(
      `http://localhost:3000/c/${owner_eci}/query/io.picolabs.manifold_owner/getManifoldPicoEci`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    console.error("getManifoldECI response data:", data);
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
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
 * Starts from the root pico and traverses down the hierarchy to find the ECI of the manifold channel on the manifold pico.
 * * @async
 * @function traverseHierarchy
 * @returns The eci of the manifold channel on the manifold pico.
 */
async function traverseHierarchy() {
  try {
    const rootECI = await getRootECI();
    const ownerECI = await getChildEciByName(rootECI, "Owner");
    const ownerInitializationECI = await getInitializationECI(ownerECI);
    const manifoldECI = await getManifoldECI(ownerInitializationECI);
    const manifoldChannel = await getECIByTag(manifoldECI, "manifold");
    return manifoldChannel;
  } catch (error) {
    console.error("Error traversing hierarchy:", error);
    throw error;
  }
}

async function getSkillsRegistryECI() {
  try {
    const rootECI = await getRootECI();
    const skillsRegistryUI = await getChildEciByName(
      rootECI,
      "Skills Registry",
    );
    const skillsRegistryECI = await getECIByTag(
      skillsRegistryUI,
      "skills_registry",
    );

    return skillsRegistryECI;
  } catch (error) {
    console.error("ECI error:", error);
  }
}

module.exports = {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  getECIByTag,
  getChildEciByName,
  getThingManifoldChannel,
  traverseHierarchy,
  getSkillsRegistryECI,
};
