const path = require("path");

/*
    getInitialECI()
    Returns the ECI of the UI pico as a javascript object--currently hardcoded to http://localhost:3000.
*/
async function getInitialECI() {
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


/*
    getManifoldECI(eci)
    Given a valid ECI for a manifold_owner pico, scans its children and returns the child ECI of the manifold pico
*/
async function getManifoldECI(eci) {
    try {
        const response = await fetch(
            `http://localhost:3000/c/${eci}/query/io.picolabs.wrangler/children`,
            { method: "POST" }
        );

        if (!response.ok) {
            throw new Error(`${response.status}`);
        }

        const data = await response.json();
        for (child in data) {
            if (child.name == "Manifold") {
                return child.eci;
            }
        }

        // If there is no manifold child yet, manifold_owner hasn't been installed
        throw new Error("manifold_owner not installed");
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
    console.log("Filepath: ", filePath);
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
            "io.picolabs.manifold_owner.krl"
        );

        const fileUrl = "file:///" + rulesetPath.split(path.sep).join("/");
        await installRuleset(eci, fileUrl);
    } catch (error) {
        console.error(error);
    }
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

module.exports = { listThings, createThing, addNote, setSquareTag, listThingsByTag, getInitialECI, installOwner };