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
      { method: "POST" },
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
    op: { kind: "query", rid: "io.picolabs.safeandmine", name: "getInformation" },
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
  console.log("Filepath: ", filePath);
  try {
    // I spent about an hour on a bug here before I realized that the header was missing from the POST section here.
    const response = await fetch(
      `http://localhost:3000/c/${eci}/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ` ${filePath}`, config: {} }),
      },
    );

    console.log("Installation response: ", response);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Ruleset response:", data);
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

if (require.main === module) {
  main();
}

// listThings(eci)
async function listThings(eci) {}

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
    const isSafeandMineInstalled = await childHasRuleset(eci, rid);

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
 * childHasRuleset(childEci, rid)
 * Returns true if the given ruleset RID is installed on the child pico identified by `childEci`.
 */
async function childHasRuleset(childEci, rid) {
  try {
    const resp = await fetch(
      `http://localhost:3000/c/${childEci}/query/io.picolabs.wrangler/installedRIDs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    console.log("Retrieving rulesets response: ", resp);

    if (!resp.ok) return false;

    const data = await resp.json();
    console.log("Ruleset data: ", data);

    if (Array.isArray(data)) {
      console.log("It was an array");

      for (const item of data) {
        if (typeof item === "string" && item === rid) return true;
        if (item && typeof item === "object") {
          if (item.rid === rid || item.name === rid || item.id === rid)
            return true;
          if (JSON.stringify(item).indexOf(rid) !== -1) return true;
        }
      }
      return false;
    }

    if (data && typeof data === "object") {
      console.log("It was an object");
      if (Object.prototype.hasOwnProperty.call(data, rid)) return true;
      for (const v of Object.values(data)) {
        if (v === rid) return true;
        if (v && typeof v === "object") {
          if (
            v.rid === rid ||
            v.name === rid ||
            JSON.stringify(v).indexOf(rid) !== -1
          )
            return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error("childHasRuleset error:", err);
    return false;
  }
}

module.exports = {
  getRootECI,
  getInitializationECI,
  getManifoldECI,
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
  listThings,
  createThing,
  addNote,
  setSquareTag,
  addTags,
  listThingsByTag,
  childHasRuleset,
  installOwner,
};
