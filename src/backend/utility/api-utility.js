const path = require("path");
const { pathToFileURL } = require("url");
const {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  getECIByTag,
  getChildEciByName,
} = require("./eci-utility");

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

module.exports = {
  picoHasRuleset,
  installOwner,
  setupRegistry,
  traverseHierarchy,
  manifold_isAChild,
  installRuleset,
};
