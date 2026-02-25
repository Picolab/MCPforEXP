const {
  getRootECI,
  getECIByTag,
  getChildEciByName,
  traverseHierarchy,
} = require("../utility/eci-utility.js");
const { getFetchRequest } = require("../utility/http-utility.js");

async function getManifoldContext() {
  try {
    const rootEci = await getRootECI();
    const ownerEci = await getChildEciByName(rootEci, "Owner");
    const updatesEci = await getECIByTag(ownerEci, "updates");

    const requestEndpoint = `c/${updatesEci}/query/io.picolabs.manifold_owner/getLLMContext`;
    const response = await getFetchRequest(requestEndpoint);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    return Array.isArray(data) ? data : data.messages || [];
  } catch (error) {
    console.error("Error fetching LLM context:", error);
    return [];
  }
}

async function updateManifoldContext(newContext) {
  try {
    const rootEci = await getRootECI();
    const ownerEci = await getChildEciByName(rootEci, "Owner");
    const updatesEci = await getECIByTag(ownerEci, "updates");

    const requestEndpoint = `/c/${updatesEci}/event-wait/manifold/updated_context`;

    // We use POST here because we are triggering an Event to change state
    const response = await fetch(
      `${process.env.PICO_ENGINE_BASE_URL}${requestEndpoint}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: newContext }),
      },
    );

    return response.ok;
  } catch (error) {
    console.error("Error updating LLM context:", error);
    return false;
  }
}

module.exports = {
  getManifoldContext,
  updateManifoldContext,
};
