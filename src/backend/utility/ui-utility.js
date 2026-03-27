const { getFetchRequest, postFetchRequest } = require("./http-utility");
const { getRootECI, getChildEciByName } = require("./eci-utility");

/**
 * Gets the name of a pico through the UI.
 * @async
 * @param {string} uiECI - The ECI of the pico whose name we want.
 * @returns {Promise<string>}
 */
async function getName(uiECI) {
  try {
    const requestEndpoint = `/c/${uiECI}/query/io.picolabs.pico-engine-ui/name`;
    const response = await postFetchRequest(requestEndpoint, {});
    if (!response.ok) throw new Error(`Failed name query: ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Name error:", error);
    throw error;
  }
}

/**
 * Find a named pico anywhere below the given node ECI through BFS.
 * @async
 * @param {string} name - The name of the pico to search for.
 * @param {string} nodeECI - The UI ECI of the current node. Start with rootECI for full search.
 * @returns {Promise<string | null>}
 */
async function findPicoBFS(name, nodeECI) {
  try {
    // Check self first
    if ((await getName(nodeECI)) == name) return nodeECI;

    // Get children
    const requestEndpoint = `/c/${nodeECI}/query/io.picolabs.pico-engine-ui/pico`;
    const response = await postFetchRequest(requestEndpoint, {});
    if (!response.ok)
      throw new Error(`Failed to get pico info: ${response.status}`);
    const data = await response.json();

    // Check children
    for (const childECI of data.children) {
      if ((await getName(childECI)) == name) return childECI;
    }

    // Recurse
    for (const childECI of data.children) {
      const bfsResult = await findPicoBFS(name, childECI);
      if (bfsResult != null) return bfsResult;
    }

    // Base case
    return null;
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

/**
 * Get the UI box info of a named pico.
 * @async
 * @param {string} name - The name of the pico to get box info for.
 * @returns {Promise<object>}
 */
async function get_box_info(name) {
  const rootECI = await getRootECI();

  const picoECI = await findPicoBFS(name, rootECI);
  if (picoECI == null) throw new Error(`Could not find named pico.`);

  const requestEndpoint = `/c/${picoECI}/query/io.picolabs.pico-engine-ui/box`;
  const response = await getFetchRequest(requestEndpoint);
  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }
  return await response.json();
}

/**
 * Update the UI box info of a named pico.
 * @async
 * @param {string} name - The name of the pico to update box info for.
 * @param {object} attributes - Supported attributes: {x: int, y: int, width: int, height: int, backgroundColor: hex_string ("#ffffff")}
 * @returns {Promise<object>}
 */
async function update_box_info(
  name,
  x = "",
  y = "",
  width = "",
  height = "",
  backgroundColor = "",
) {
  const rootECI = await getRootECI();

  const picoECI = await findPicoBFS(name, rootECI);
  if (picoECI == null) throw new Error(`Could not find named pico.`);

  const requestEndpoint = `/c/${picoECI}/event-wait/engine_ui/box`;
  const response = await postFetchRequest(requestEndpoint, {
    x,
    y,
    width,
    height,
    backgroundColor,
  });
  if (!response.ok) {
    throw new Error(
      `HTTP Error (${response.status}): ${await response.text()}`,
    );
  }
  return await response.json();
}

module.exports = {
  get_box_info,
  update_box_info,
};
