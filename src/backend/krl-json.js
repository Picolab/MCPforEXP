/**
 * Uniform JSON envelope helpers for calling KRL (events + queries) via pico-engine HTTP endpoints.
 *
 * Request envelope (MCP -> adapter):
 * {
 *   "id": "optional-correlation-id",
 *   "target": { "eci": "..." },
 *   "op": {
 *     "kind": "query" | "event",
 *     "rid": "io.picolabs.manifold_pico",      // for queries
 *     "name": "getThings",                      // for queries
 *     "domain": "manifold",                     // for events
 *     "type": "create_thing"                    // for events
 *   },
 *   "args": { ... }                             // query args or event attrs
 * }
 *
 * Response envelope (adapter -> MCP):
 * {
 *   "id": "...",
 *   "ok": true,
 *   "data": <any>,
 *   "meta": { "kind": "...", "eci": "...", "rid/domain": "...", "name/type": "...", "httpStatus": 200 }
 * }
 *
 * Error envelope:
 * {
 *   "id": "...",
 *   "ok": false,
 *   "error": { "code": "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_REQUEST", "message": "...", "details": <any> },
 *   "meta": { ... }
 * }
 */

function normalizeId(id) {
  if (typeof id === "string" && id.length > 0) return id;
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function okResponse({ id, data, meta }) {
  return { id: normalizeId(id), ok: true, data, meta };
}

function errResponse({ id, code, message, details, meta }) {
  return {
    id: normalizeId(id),
    ok: false,
    error: { code, message, details },
    meta,
  };
}

function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== "object") {
    return { ok: false, message: "Request must be an object" };
  }
  const { target, op, args } = envelope;
  if (!target || typeof target !== "object" || typeof target.eci !== "string") {
    return { ok: false, message: 'Missing required field: target.eci (string)' };
  }
  if (!op || typeof op !== "object" || (op.kind !== "query" && op.kind !== "event")) {
    return { ok: false, message: 'Missing required field: op.kind ("query"|"event")' };
  }
  if (op.kind === "query") {
    if (typeof op.rid !== "string" || typeof op.name !== "string") {
      return { ok: false, message: 'Query requires op.rid (string) and op.name (string)' };
    }
  } else {
    if (typeof op.domain !== "string" || typeof op.type !== "string") {
      return { ok: false, message: 'Event requires op.domain (string) and op.type (string)' };
    }
  }
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
    return { ok: false, message: "args must be an object if provided" };
  }
  return { ok: true };
}

module.exports = {
  normalizeId,
  okResponse,
  errResponse,
  validateEnvelope,
};

