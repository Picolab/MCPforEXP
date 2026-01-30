const path = require("path");
const { pathToFileURL } = require("url");

/*
    getRootECI()
    Returns the ECI of the UI pico as a javascript object--currently hardcoded to http://localhost:3000.
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

async function setupRegistry() {
  const rootEci = await getRootECI();
  const filePath = path.resolve(
    __dirname,
    "../../Manifold-api/io.picolabs.manifold_bootstrap.krl",
  );
  const fileUrl = pathToFileURL(filePath).href;

  await installRuleset(rootEci, fileUrl);
  console.log(
    "Bootstrap ruleset installed. Waiting for channel and completion...",
  );

  let bootstrapEci = null;
  const maxAttempts = 30;

  console.log("Waiting for bootstrap to complete (this may take up to 30s):");
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Search for the authorized "bootstrap" channel
      if (!bootstrapEci) {
        const picoResp = await fetch(
          `http://127.0.0.1:3000/c/${rootEci}/query/io.picolabs.pico-engine-ui/pico`,
        );

        if (picoResp.ok) {
          const data = await picoResp.json();
          if (data && data.channels) {
            const chan = data.channels.find(
              (c) =>
                c.name === "bootstrap" ||
                (c.tags && c.tags.includes("bootstrap")),
            );

            if (chan && chan.id) {
              bootstrapEci = chan.id;
              console.log(`\nBootstrap channel found: ${bootstrapEci}`);
            }
          }
        }
      }

      // If we found the channel, check if the full process is done
      if (bootstrapEci) {
        const resp = await fetch(
          `http://127.0.0.1:3000/c/${bootstrapEci}/query/io.picolabs.manifold_bootstrap/getBootstrapStatus`,
        );

        if (resp.ok) {
          const status = await resp.json();
          if (status && status.owner_eci) {
            return status;
          }
        }
      }
    } catch (error) {
      // Silently retry during the 30-second window
    }

    process.stdout.write("."); // Visual progress
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    "Bootstrap timed out before reaching the 'Owner' completion step.",
  );
}

async function getInitializationECI(owner_eci) {
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
      if (channel.tags.includes("initialization")) {
        return channel.id;
      }
    }
    throw new Error("Initialization ECI not found!");
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

/*
    getManifoldECI(owner_eci)
    Given a valid (initialization) ECI for a manifold_owner pico, scans its children and returns the child ECI of the manifold pico
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

/*
    installRuleset(eci, filePath)
    Given a valid engine/UI ECI and KRL filepath, installs the KRL ruleset.
    Note: filePath requires the same "file:///..." convention as the pico-engine UI
*/
async function installRuleset(eci, filePath) {
  try {
    // Parses filePath to get ruleset id
    const rid = filePath.split("/").at(-1).replace(".krl", "");
    if (await picoHasRuleset(eci, rid)) return;

    // I spent about an hour on a bug here before I realized that the header was missing from the POST section here.
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

/*
    installOwner(eci)
    Given a valid engine/UI ECI (and run from the root of the repo), automatically finds and installs the manifold_owner ruleset.
*/
async function installOwner(eci) {
  try {
    const cwd = process.cwd();
    const rootFolderName = "MCPforEXP";
    const rootIndex = cwd.indexOf(rootFolderName);
    const rootPath = cwd.slice(0, rootIndex + rootFolderName.length);

    // There seems to be some issue with the way "/" and "\" interact with the api request
    // This should normalize them to all be the same and it should act as a path.
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

/*
    initializeManifold()
    Assumes a fresh pico-engine, but shouldn't break in the case you already have everything installed already.
    Returns the ECI of the manifold pico as a string.
*/
async function initializeManifold() {
  const rootECI = await getRootECI();
  await installOwner(rootECI);
  const initializationECI = await getInitializationECI(rootECI);
  const manifoldECI = await getManifoldECI(initializationECI);
  return manifoldECI;
}

async function main() {
  const manifoldECI = await initializeManifold();
  console.log(`Manifold ECI channel: ${manifoldECI}`);
}

main();

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
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

// createThing(eci, name)
async function createThing(eci, name) {}

// addNote(eci, title, content)
async function addNote(eci, title, content) {}

// setSquareTag(eci, tagID, domain)
async function setSquareTag(eci, tagID, domain) {}

// listThingsByTag(eci, tag)
async function listThingsByTag(eci, tag) {}

// addTags(eci, tag)
async function addTags(eci, tag) {
  try {
    const rid = "io.picolabs.safeandmine";
    const isSafeandMineInstalled = await picoHasRuleset(eci, rid);

    if (!isSafeandMineInstalled) {
      console.log("Ruleset is not installed, beginning installation now.");

      const absolutePath = path.join(
        __dirname,
        `../../Manifold-api/${rid}.krl`,
      );
      const rulesetUrl = pathToFileURL(absolutePath).href;

      await installRuleset(eci, rulesetUrl);
      console.log("Installed safeandmine ruleset");
    }
  } catch (err) {
    console.error("Error in addTags:", err);
  }
}
/**
 * picoHasRuleset(picoEci, rid)
 * Returns true if the given ruleset RID is installed on the pico identified by `picoEci`.
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

module.exports = {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  listThings,
  createThing,
  addNote,
  setSquareTag,
  addTags,
  listThingsByTag,
  picoHasRuleset,
  installOwner,
  setupRegistry,
};
