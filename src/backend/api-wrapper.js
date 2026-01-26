const path = require("path");

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
        const response = await fetch(`http://localhost:3000/c/${owner_eci}/query/io.picolabs.pico-engine-ui/pico`);

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
    Given a valid ECI for a manifold_owner pico, scans its children and returns the child ECI of the manifold pico
*/
async function getManifoldECI(owner_eci) {
    try {
        const response = await fetch(
            `http://localhost:3000/c/${owner_eci}/query/io.picolabs.manifold_owner/getManifoldPicoEci`,
            { method: "POST" }
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
    // console.log("Filepath: ", filePath);
    try {
        // I spent about an hour on a bug here before I realized that the header was missing from the POST section here.
        const response = await fetch(
            `http://localhost:3000/c/${eci}/event/engine_ui/install/query/io.picolabs.pico-engine-ui/pico`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: ` ${filePath}`, config: {} })
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // console.log("Ruleset response:", data);
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
            "io.picolabs.manifold_owner.krl"
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

module.exports = { listThings, createThing, addNote, setSquareTag, listThingsByTag, installOwner };