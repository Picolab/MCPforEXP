const { callKrl } = require("./krl-client");

/**
 * Uniform KRL operations (events/queries) for MCP integration.
 * These return the standard envelope from `callKrl`:
 * { id, ok, data, error?, meta }
 */

// --- manifold_pico queries ---

/**
 * Retrieves all "Things" currently managed by the Manifold Pico.
 * @async
 * @param {string} eci - The ECI of the Manifold Pico.
 * @param {string|number} id - Correlation ID for the request.
 * @returns {Promise<KrlResponse>} Standard envelope containing the map of things.
 */
async function manifold_getThings(eci, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.manifold_pico", name: "getThings" },
    args: {},
  });
}

/**
 * Checks if a specific Pico ID is a registered child of the Manifold.
 * @async
 * @param {string} eci - The ECI of the Manifold Pico.
 * @param {string} picoID - The ID of the Pico to verify.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Boolean response wrapped in the KRL envelope.
 */
async function manifold_isAChild(eci, picoID, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.manifold_pico", name: "isAChild" },
    args: { picoID },
  });
}

// --- manifold_pico events ---

/**
 * Triggers the creation of a new Thing Pico.
 * @async
 * @param {string} eci - The ECI of the Manifold Pico.
 * @param {string} name - Display name for the new Thing.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Directive confirming the creation request was queued.
 */
async function manifold_create_thing(eci, name, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "create_thing" },
    args: { name },
  });
}

/**
 * Removes a Thing Pico and its associated subscriptions from Manifold.
 * @async
 * @param {string} eci - The ECI of the Manifold Pico.
 * @param {string} picoID - The ID of the Thing Pico to remove.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Standard KRL envelope.
 */
async function manifold_remove_thing(eci, picoID, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "remove_thing" },
    args: { picoID },
  });
}

/**
 * Updates the display name of an existing Thing Pico.
 * @async
 * @param {string} eci - The ECI of the Manifold Pico.
 * @param {string} picoID - The ID of the Thing to change.
 * @param {string} changedName - The new name for the Thing.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} Standard KRL envelope.
 */
async function manifold_change_thing_name(eci, picoID, changedName, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "manifold", type: "change_thing_name" },
    args: { picoID, changedName },
  });
}

// --- safeandmine queries ---

/**
 * Retrieves owner contact information from a specific Thing Pico.
 * @async
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {string} [info] - Optional specific field to retrieve (e.g., 'email').
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} The requested info map or field.
 */
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

/**
 * Lists all SquareTags currently registered to a Thing Pico.
 * @async
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {string|number} id - Correlation ID.
 * @returns {Promise<KrlResponse>} A list of tag objects.
 */
async function safeandmine_getTags(eci, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "query", rid: "io.picolabs.safeandmine", name: "getTags" },
    args: {},
  });
}

// --- safeandmine events ---

/**
 * Updates the owner contact profile for a Thing.
 * @async
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {Object} profile - The profile details.
 * @param {string} [profile.name] - Owner name.
 * @param {string} [profile.email] - Owner email.
 * @param {string} [profile.phone] - Owner phone.
 * @param {string} [profile.message] - Custom "if found" message.
 * @param {boolean} [profile.shareName] - Whether to publically share name.
 * @param {string|number} id - Correlation ID.
 */
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

/**
 * Deletes a registered SquareTag or specific owner data from a Thing Pico.
 * @async
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {string} [toDelete] - The specific identifier or tag ID to be removed.
 * @param {string|number} id - Correlation ID for the request.
 * @returns {Promise<KrlResponse>} Standard KRL envelope confirming the deletion event was processed.
 */
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

/**
 * Registers a new SquareTag to the Thing Pico and the global registry.
 * @async
 * @param {string} eci - The ECI of the Thing Pico.
 * @param {string} tagID - The unique ID of the tag.
 * @param {string} domain - The namespace for the tag (e.g., 'sqtg').
 * @param {string|number} id - Correlation ID.
 */
async function safeandmine_newtag(eci, tagID, domain, id) {
  return callKrl({
    id,
    target: { eci },
    op: { kind: "event", domain: "safeandmine", type: "new_tag" },
    args: { tagID, domain },
  });
}

module.exports = {
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
