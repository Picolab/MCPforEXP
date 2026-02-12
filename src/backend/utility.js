const path = require("path");
const { pathToFileURL } = require("url");

// THIS SHOULD BE INCLUDED INSIDE OF AN INDEX.JS BUT SINCE WE DON'T HAVE ONE YET:
require("dotenv").config();

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
    console.log("BEFORE SEND API CALL IN ROOT ECI");
    const response = await sendAPICall(requestEndpoint, true, {});
    console.log("AfTER SENDAPI call in GETROOTECI");
    const data = await response.json();
    await checkError(data);
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

      requestEndpoint = `/c/${bootstrapEci}/query/io.picolabs.manifold_bootstrap/getBootstrapStatus`;
      requestBody = {
        method: "GET",
        headers: { "Content-Type": "application-json" },
      };

      const status = await sendAPICall(requestEndpoint, requestBody);
      if (status && status.owner_eci) {
        console.log("\n Bootstrap Complete.");
        return status;
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
    const parentRequestEndpoint = `/c/${parentEci}/query/io.picolabs.pico-engine-ui/pico`;
    const parentRequestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };

    const data = await sendAPICall(parentRequestEndpoint, parentRequestBody);
    const childEcis = data.children || [];

    // We must query each child individually to find the one with the matching name
    for (const childEci of childEcis) {
      try {
        const requestEndpoint = `/c/${childEci}/query/io.picolabs.pico-engine-ui/name`;
        const requestBody = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        };

        const actualName = await sendAPICall(requestEndpoint, requestBody);

        if (nameResp.ok) {
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
    const requestEndpoint = `/c/${owner_eci}/query/io.picolabs.pico-engine-ui/pico`;
    const requestBody = {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
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
    const requestEndpoint = `/c/${owner_eci}/query/io.picolabs.manifold_owner/getManifoldPicoEci`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
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

    const requestEndpoint = `/c/${eci}/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico`;
    const requestBody = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: ` ${filePath}`, config: {} }),
    };

    const data = await sendAPICall(requestEndpoint, requestBody);
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
    const requestEndpoint = `/c/${picoEci}/query/io.picolabs.pico-engine-ui/pico`;
    const requestBody = {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    };
    const data = await sendAPICall(requestEndpoint, requestBody);
    for (const ruleset of data.rulesets) {
      if (ruleset.rid === rid) return true;
    }

    return false;
  } catch (err) {
    console.error("picoHasRuleset error:", err);
    return false;
  }
}

/**
 * @param {*} variable - This should be the enviornement variable accessed by process.env.<VAR_NAME>
 * @param {*} variableName - This is the name of the variable passed in for error logging purposes.
 * @returns - The variable if it's not null. This way we don't have to worry about null errors.
 *
 * This function first checks to see if the varable is not null. If it's not it returns it.
 * If it is, it throws an error.
 */
async function checkENVVariable(variable, variableName) {
  if (variable !== null) {
    return variable;
  } else {
    throw new Error(
      `The enviornment variable ${variableName} is null in the enviornment`,
    );
  }
}

/**
 * @param {*} requestURL - Should be the pico url starting with /c/...
 * @param {*} simpleRequest - Bool value that signifies if the request has a request body.
 * @param {*} body - The request body included with the fetch call.
 * @returns - The response body JSON
 *
 * This function takes in the request url and body.
 * It then pulls in the base url from the enviornment variable and then sends a request to
 * the endpoint <baseURL>+<requestURL>.
 * It then checks for errors and returns the response if no error.
 *
 */
async function sendAPICall(requestEndpoint, simpleRequest, requestBody) {
  const baseURL = await checkENVVariable(process.env.PICO_ENGINE_BASE_URL, "PICO_ENGINE_BASE_URL");
  const requestURL = baseURL + requestEndpoint;
  console.log("RequestURL: ", requestURL);

  let response = null;

  // try the simple request
  if (simpleRequest) {
    try {
      console.log("SIMPLE REQUEST");
      response = await fetch(requestURL);
      if (!response.ok) {
        throw new Error(`${response.status}`);
      }
    } catch (err) {
      console.log("Simple request failed: ", err);
    }
  } else {
    try {
      response = await fetch(requestURL, {
      method: requestBody.method,
      headers: requestBody.headers
    });
    if (!response.ok) {
        throw new Error(`${response.status}`);
      }
    } catch (err)  {
      console.log("Request with body failed: ", err);
    }
  }

  return response;
}


async function checkError(data) {
  if (error in data) {
    throw new Error(`Error from ${requestURL}: ${JSON.stringify(data)}`);
  }
}



module.exports = {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  picoHasRuleset,
  installOwner,
  installRuleset,
  setupRegistry,
  getECIByTag,
  getChildEciByName,
  sendAPICall,
};
