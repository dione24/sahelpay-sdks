# Billing contract source

`billing-openapi.json` is the unmodified projection of the 13 supported Billing
paths and referenced schemas from backend main. `source.revision` pins its commit.

```sh
python3 scripts/sync-billing-contract.py /path/to/sahelPay/openapi.json --revision BACKEND_SHA
python3 scripts/sync-billing-contract.py /path/to/sahelPay/openapi.json --revision BACKEND_SHA --check
cd javascript && npm test
```

Release checks compare fresh backend main before merge; CI uses the checked-in
projection because it cannot access the private backend. Contract tests cover every
supported operation, all documented creation/query fields, server response assignability
in public TypeScript types, and schema validation of source-derived synthetic
fixtures. Fixtures are not customer traffic or proof of real settlement. The three
SDK test suites replay the same fixtures without network calls.

Additive fields stay optional for servers before #214/#215. Existing list return
shapes remain unchanged; JS `plans.listPage`/Python `plans.list_page` expose the
new outer pagination. Explicit idempotency keys are never generated silently for
Billing; a caller must keep its key stable across retries. An empty explicit key
is sent so the server can reject it, rather than silently creating a new resource.

The public package is prepared as 1.3.0; immutable 1.2.0 tags remain unchanged.
Registry publication is blocked; use the source release or main. No backend
production changes or reminder enablement are performed by the SDK.

PATCH plan bodies are still absent from backend OpenAPI; the existing update fields
remain sourced from merchant.controller.ts. All response envelopes are formalized.
