const api = require("./api-wrapper");
const { normalizeId, okResponse, errResponse } = require("./krl-json");

/**
 * Uniform KRL operations (events/queries) for MCP integration.
 * These return the standard envelope from `callKrl`:
 * { id, ok, data, error?, meta }
 */

// --- manifold_pico queries ---

/**
 * Retrieves all "Things" currently managed by the Manifold Pico.
 * @async
 * @param {string|number} id - Correlation ID for the request.
 * @returns {Promise<KrlResponse>} Standard envelope containing the map of things.
 */
async function manifold_getThings(id) {
  try {
    const data = await api.listThings();
    return okResponse({
      id,
      data,
      meta: { kind: "query", domain: "manifold" },
    });
  } catch (error) {
    return errResponse({ id, code: "ENGINE_ERROR", message: error.message });
  }
}

/**
 * Checks if a thing with the given name is a registered child of the Manifold.
 * @async
 * @param {string} thingName - The name of the thing to verify.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Boolean response wrapped in the KRL envelope.
 */
async function manifold_isAChild(thingName, id) {
  try {
    const data = await api.manifold_isAChild(thingName);
    return okResponse({
      id,
      data,
      meta: { kind: "query", rid: "io.picolabs.manifold_pico", name: "isAChild", httpStatus: 200 },
    });
  } catch (error) {
    return errResponse({ id, code: "ENGINE_ERROR", message: error.message });
  }
}

// --- manifold_pico events ---

/**
 * manifold_create_thing(eci, name, id)
 * Creates a new thing pico and waits for it to be initialized.
 * Uses createThing internally which waits for completion and returns the thing's ECI.
 * Returns uniform envelope format: { id, ok, data: { thingEci }, error?, meta }
 */
async function manifold_create_thing(name, id) {
  try {
    const thingEci = await api.createThing(name);
    return okResponse({
      id,
      data: { thingEci },
      meta: { kind: "event", type: "create_thing", httpStatus: 200 },
    });
  } catch (error) {
    return errResponse({ id, code: "TIMEOUT_ERROR", message: error.message });
  }
}

/**
 * Removes a Thing Pico by name and its associated subscriptions from Manifold.
 * @async
 * @param {string} thingName - The name of the Thing Pico to remove.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Standard KRL envelope.
 */
async function manifold_remove_thing(thingName, id) {
  try {
    const data = await api.removeThingByName(thingName);
    return okResponse({
      id,
      data,
      meta: { kind: "event", domain: "manifold", type: "remove_thing", httpStatus: 200 },
    });
  } catch (error) {
    return errResponse({ id, code: "ENGINE_ERROR", message: error.message });
  }
}
/**
 * Updates the display name of an existing Thing Pico (by thing name).
 * @async
 * @param {string} thingName - The current name of the Thing.
 * @param {string} changedName - The new name for the Thing.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Standard KRL envelope.
 */
async function manifold_change_thing_name(thingName, changedName, id) {
  try {
    const data = await api.manifold_change_thing_name(thingName, changedName);
    return okResponse({
      id,
      data,
      meta: { kind: "event", domain: "manifold", type: "change_thing_name", httpStatus: 200 },
    });
  } catch (error) {
    return errResponse({ id, code: "ENGINE_ERROR", message: error.message });
  }
}

/**
 * Registers a new SquareTag to the Thing Pico and the global registry.
 * @async
 * @param {string} thingName - The name of the Thing Pico.
 * @param {string} tagID - The unique ID of the tag.
 * @param {string} domain - The namespace for the tag (e.g., 'sqtg').
 * @param {string|number} id - Correlation ID.
 */
async function safeandmine_newtag(thingName, tagID, domain, id) {
  try {
    const data = await api.setSquareTag(thingName, tagID, domain);
    return okResponse({
      id,
      data,
      meta: { kind: "event", domain: "safeandmine" },
    });
  } catch (error) {
    return errResponse({ id, code: "INSTALL_ERROR", message: error.message });
  }
}

module.exports = {
  manifold_getThings,
  manifold_isAChild,
  manifold_create_thing,
  manifold_remove_thing,
  manifold_change_thing_name,
  safeandmine_newtag,
};
