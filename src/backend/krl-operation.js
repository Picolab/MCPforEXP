const { callKrl } = require("./krl-client");

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
