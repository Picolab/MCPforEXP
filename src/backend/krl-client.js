const { errResponse, okResponse, validateEnvelope } = require("./krl-json");

const DEFAULT_BASE_URL = "http://localhost:3000";

async function safeReadJson(resp) {
  try {
    return await resp.json();
  } catch (_e) {
    return undefined;
  }
}

/**
 * callKrl(envelope, options?)
 * Executes either a KRL query or event using pico-engine UI-style endpoints:
 * - Query: POST {baseUrl}/c/{eci}/query/{rid}/{name}
 * - Event: POST {baseUrl}/c/{eci}/event/{domain}/{type}
 */
async function callKrl(envelope, options = {}) {
  const validation = validateEnvelope(envelope);
  if (!validation.ok) {
    return errResponse({
      id: envelope && envelope.id,
      code: "INVALID_REQUEST",
      message: validation.message,
      details: { envelope },
      meta: { kind: envelope?.op?.kind },
    });
  }

  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const { id, target, op, args = {} } = envelope;
  const eci = target.eci;

  const url =
    op.kind === "query"
      ? `${baseUrl}/c/${encodeURIComponent(eci)}/query/${encodeURIComponent(
          op.rid,
        )}/${encodeURIComponent(op.name)}`
      : `${baseUrl}/c/${encodeURIComponent(eci)}/event/${encodeURIComponent(
          op.domain,
        )}/${encodeURIComponent(op.type)}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    const payload = await safeReadJson(resp);
    const meta =
      op.kind === "query"
        ? {
            kind: op.kind,
            eci,
            rid: op.rid,
            name: op.name,
            httpStatus: resp.status,
          }
        : {
            kind: op.kind,
            eci,
            domain: op.domain,
            type: op.type,
            httpStatus: resp.status,
          };

    if (!resp.ok) {
      return errResponse({
        id,
        code: "HTTP_ERROR",
        message: `Upstream returned HTTP ${resp.status}`,
        details: payload,
        meta,
      });
    }

    return okResponse({ id, data: payload, meta });
  } catch (e) {
    return errResponse({
      id,
      code: "NETWORK_ERROR",
      message: e && e.message ? e.message : "Network error calling pico-engine",
      details: { url },
      meta: {
        kind: op.kind,
        eci,
        ...(op.kind === "query" ? { rid: op.rid, name: op.name } : { domain: op.domain, type: op.type }),
      },
    });
  }
}

module.exports = {
  callKrl,
  DEFAULT_BASE_URL,
};

