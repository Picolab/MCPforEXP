const path = require("path");
const { pathToFileURL } = require("url");
const { callKrl } = require("./krl-client");

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

/**
 * getChildEciByName(parentEci, childName)
 * Queries a parent Pico to find the ECI of a child Pico with a specific name.
 * Uses the engine-ui/pico query for authorized access.
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

/**
 * Uniform KRL operations (events/queries) for MCP integration.
 * These return the standard envelope from `callKrl`:
 * { id, ok, data, error?, meta }
 */

// manifold_pico queries
async function manifold_getThings(eci, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.manifold_pico", name: "getThings" },
    args: {},
  });
}

async function manifold_isAChild(eci, picoID, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.manifold_pico", name: "isAChild" },
    args: { picoID },
  });
}

// manifold_pico events
async function manifold_create_thing(eci, name, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "create_thing" },
    args: { name },
  });
}

async function manifold_remove_thing(eci, picoID, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "remove_thing" },
    args: { picoID },
  });
}

async function manifold_change_thing_name(eci, picoID, changedName, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "change_thing_name" },
    args: { picoID, changedName },
  });
}

// safeandmine (installed on thing picos) queries
async function safeandmine_getInformation(eci, info, id) {
  // `info` is optional in the KRL; if omitted it returns the whole map.
  const args = {};
  if (info !== undefined) args.info = info;
  return callKrl({
    id,
    target: { eci },
    op: {
      kind: "query",
      rid: "io.picolabs.safeandmine",
      name: "getInformation",
    },
    args,
  });
}

async function safeandmine_getTags(eci, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.safeandmine", name: "getTags" },
    args: {},
  });
}

// safeandmine events
async function safeandmine_update(
  eci,
  { name, email, phone, message, shareName, shareEmail, sharePhone } = {},
  id,
) {
  const args = {};
  if (name !== undefined) args.name = name;
  if (email !== undefined) args.email = email;
  if (phone !== undefined) args.phone = phone;
  if (message !== undefined) args.message = message;
  if (shareName !== undefined) args.shareName = !!shareName;
  if (shareEmail !== undefined) args.shareEmail = !!shareEmail;
  if (sharePhone !== undefined) args.sharePhone = !!sharePhone;

  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "safeandmine", type: "update" },
    args,
  });
}

async function safeandmine_delete(eci, toDelete, id) {
  const args = {};
  if (toDelete !== undefined) args.toDelete = toDelete;
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "safeandmine", type: "delete" },
    args,
  });
}

async function safeandmine_newtag(eci, tagID, domain, id) {
  // KRL event is `new_tag`
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "safeandmine", type: "new_tag" },
    args: { tagID, domain },
  });
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
// main();

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
  console.log(`Creating Thing: "${thingName}"...`);

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
    console.log("Creation event accepted. Searching for new child Pico...");

    // Since the ECI isn't in the response, we poll for the child by name
    // Try for 10 seconds to give the engine time to finish initialization
    for (let i = 0; i < 10; i++) {
      const thingEci = await getChildEciByName(manifoldEci, thingName);
      if (thingEci) {
        console.log(`✅ Thing "${thingName}" found! ECI: ${thingEci}`);
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

    const response = await fetch(
      `http://127.0.0.1:3000/c/${eci}/event/safeandmine/new_tag`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagID: tagId, domain: domain }),
      },
    );

    const data = await response.json();
    console.log("Data is", data);

    return data;
  } catch (err) {
    console.error("Error in setSquareTag:", err);
    throw err;
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
  main,
  getRootECI,
  getInitializationECI,
  getManifoldECI,
  listThings,
  createThing,
  addNote,
  addTag,
  setSquareTag,
  listThingsByTag,
  picoHasRuleset,
  installOwner,
  setupRegistry,
  getECIByTag,
  getChildEciByName,
  // Uniform MCP-friendly ops
  manifold_getThings,
  manifold_isAChild,
  manifold_create_thing,
  manifold_remove_thing,
  manifold_change_thing_name,
  safeandmine_getInformation,
  safeandmine_getTags,
  safeandmine_update,
  safeandmine_delete,
  safeandmine_newtag,
};
