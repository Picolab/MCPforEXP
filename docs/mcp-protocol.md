# Uniform JSON for MCP ↔ KRL (events + queries)

This repo includes a small adapter that normalizes **all** pico-engine calls (KRL queries + events) into a single JSON envelope.

## Request envelope

Use this shape for every operation:

```json
{
  "id": "optional-correlation-id",
  "target": { "eci": "ECI_HERE" },
  "op": {
    "kind": "query",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings"
  },
  "args": {}
}
```

- **Queries** use `op.kind="query"` with `op.rid` + `op.name`
- **Events** use `op.kind="event"` with `op.domain` + `op.type`
- **Args** are always an object (query args or event attrs)

## Response envelope

Success:

```json
{
  "id": "optional-correlation-id",
  "ok": true,
  "data": {},
  "meta": {
    "kind": "query",
    "eci": "ECI_HERE",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings",
    "httpStatus": 200
  }
}
```

Error:

```json
{
  "id": "optional-correlation-id",
  "ok": false,
  "error": {
    "code": "HTTP_ERROR",
    "message": "Upstream returned HTTP 500",
    "details": {}
  },
  "meta": {
    "kind": "query",
    "eci": "ECI_HERE",
    "rid": "io.picolabs.manifold_pico",
    "name": "getThings",
    "httpStatus": 500
  }
}
```

## Implemented operations (MCP-friendly)

These helpers live in `src/backend/krl-operation.js` and all return the envelope above:

- **Manifold pico**
  - Query: `manifold_getThings()`
  - Event: `manifold_create_thing(thingName)`
  - Event: `manifold_remove_thing(thingName)`
  - Event: `manifold_change_thing_name(thingName, changedName)` (note: KRL expects `changedName`)
- **Thing pico (safeandmine + journal ruleset)**
  - Query: `scanTag(tagId, domain)`
  - Query: `getNote(thingName, title)`
  - Event: `updateOwnerInfo(thingName, ownerInfo: { name,email,phone,message, shareName,shareEmail,sharePhone })`
  - Event: `safeandmine_newtag(thingName, tagID, domain)`
  - Event: `addNote(thingName, title, content)`
