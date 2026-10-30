# Billing contract source

`billing-openapi.json` is the unmodified projection of supported Billing paths and
referenced schemas in `dione24/sahelPay/openapi.json`. `source.revision` pins the
backend commit. Update/check it with:

```sh
python3 scripts/sync-billing-contract.py /path/to/sahelPay/openapi.json --revision BACKEND_SHA
python3 scripts/sync-billing-contract.py /path/to/sahelPay/openapi.json --revision BACKEND_SHA --check
cd javascript && npm test
```

The public SDK CI uses this checked-in projection: the private backend need not be
accessible from a public CI job. Release checks must compare fresh backend main
with `--check`; editing the snapshot causes the TypeScript contract tests to check
request fields, optionality, primitives and enum values against the actual exports.

At ec4548f the generated OpenAPI omits GET subscription by ID, subscription import,
`external_ref` on with-payment, plan bodies, invoice DTO properties and response
schemas. These are implemented from the same revision's controller/service and
covered with source-derived fixtures in `test-vectors/billing`. Fixtures are
synthetic recordings of those response shapes, not customer traffic or evidence of
a live payment. No upstream gaps are silently filled into the OpenAPI snapshot.
