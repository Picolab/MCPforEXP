const path = require("path");
const { pathToFileURL } = require("url");

/**
 * Fetches the root ECI of the UI pico from the engine's local context.
 * * @async
 * @function getRootECI
 * @returns {Promise<string|undefined>} The ECI string for the root UI pico, or undefined if the fetch fails.
 * @throws {Error} If the response status is not OK.
 */
async function getRootECI() {
  try {
    const response = await fetch(`http://localhost:3000/api/ui-context`);

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const data = await response.json();
    return data.eci;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * Orchestrates the full bootstrap sequence for the Manifold platform.
 * Installs the bootstrap ruleset on the root pico and polls for the creation of the
 * Tag Registry and Owner picos.
 * * @async
 * @function setupRegistry
 * @returns {Promise<Object>} An object containing the final bootstrap status:
 * {
 * tag_registry_eci,
 * tag_registry_registration_eci,
 * owner_eci
 * }
 * @throws {Error} If the bootstrap process fails to complete within 30 seconds.
 */
async function setupRegistry() {
  const rootEci = await getRootECI();
  const filePath = path.resolve(
    __dirname,
    "../../Manifold-api/io.picolabs.manifold_bootstrap.krl",
  );
  const fileUrl = pathToFileURL(filePath).href;

  await installRuleset(rootEci, fileUrl);
  console.log("Bootstrap ruleset installed. Waiting for completion...");

  let bootstrapEci = null;
  const maxAttempts = 30;

  console.log("Waiting for bootstrap to complete (this may take up to 30s):");
  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (!bootstrapEci) {
        bootstrapEci = await getECIByTag(rootEci, "bootstrap");
        if (bootstrapEci) {
          console.log(`\nBootstrap channel found: ${bootstrapEci}`);
        }
      }

      if (bootstrapEci) {
        const resp = await fetch(
          `http://127.0.0.1:3000/c/${bootstrapEci}/query/io.picolabs.manifold_bootstrap/getBootstrapStatus`,
        );

        if (resp.ok) {
          const status = await resp.json();
          if (status && status.owner_eci) {
            console.log("\n Bootstrap Complete.");
            return status;
          }
        }
      }
    } catch (error) {
      // Let it silently retry
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    "Bootstrap timed out before reaching the 'Owner' completion step.",
  );
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

    console.log("Returning null from getChildEciByName");
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
    const response = await fetch(
      `http://localhost:3000/c/${owner_eci}/query/io.picolabs.pico-engine-ui/pico`,
    );

    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

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
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * Installs a KRL ruleset on a pico using its file URL.
 * * @async
 * @function installRuleset
 * @param {string} eci - The ECI of the pico where the ruleset should be installed.
 * @param {string} filePath - The absolute file URL (e.g., "file:///C:/...").
 * @returns {Promise<void>}
 * @throws {Error} If the installation event fails.
 */
async function installRuleset(eci, filePath) {
  try {
    const rid = filePath.split("/").at(-1).replace(".krl", "");
    if (await picoHasRuleset(eci, rid)) return;

    const response = await fetch(
      `http://localhost:3000/c/${eci}/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ` ${filePath}`, config: {} }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/**
 * Specifically installs the manifold_owner ruleset onto a pico.
 * Automatically resolves the local file path based on the project structure.
 * * @async
 * @function installOwner
 * @param {string} eci - The ECI of the target pico.
 * @returns {Promise<void>}
 */
async function installOwner(eci) {
  try {
    const cwd = process.cwd();
    const rootFolderName = "MCPforEXP";
    const rootIndex = cwd.indexOf(rootFolderName);
    const rootPath = cwd.slice(0, rootIndex + rootFolderName.length);

    const rulesetPath = path.join(
      rootPath,
      "Manifold-api",
      "io.picolabs.manifold_owner.krl",
    );

    const fileUrl = "file:///" + rulesetPath.split(path.sep).join("/");
    await installRuleset(eci, fileUrl);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Checks if a specific ruleset is already installed on a pico.
 * * @async
 * @function picoHasRuleset
 * @param {string} picoEci - The ECI of the pico to inspect.
 * @param {string} rid - The Ruleset ID to look for.
 * @returns {Promise<boolean>} True if the RID is found in the rulesets list, false otherwise.
 */
async function picoHasRuleset(picoEci, rid) {
  try {
    const resp = await fetch(
      `http://localhost:3000/c/${picoEci}/query/io.picolabs.pico-engine-ui/pico`,
      {
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!resp.ok) return false;

    const data = await resp.json();

    for (const ruleset of data.rulesets) {
      if (ruleset.rid === rid) return true;
    }

    return false;
  } catch (err) {
    console.error("picoHasRuleset error:", err);
    return false;
  }
}

async function traverseHierarchy() {
  const rootECI = await getRootECI();
  const ownerECI = await getChildEciByName(rootECI, "Owner");
  const ownerInitializationECI = await getInitializationECI(ownerECI);
  const manifoldECI = await getManifoldECI(ownerInitializationECI);
  const manifoldChannel = await getECIByTag(manifoldECI, "manifold");
  return manifoldChannel;
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

module.exports = {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  picoHasRuleset,
  installOwner,
  setupRegistry,
  getECIByTag,
  getChildEciByName,
  traverseHierarchy,
  getThingManifoldChannel,
  manifold_isAChild,
  installRuleset,
};
