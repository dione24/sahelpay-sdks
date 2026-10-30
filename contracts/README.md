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

Backend #213 formalizes canonical GET, import and checkout `external_ref` metadata.
Backend #214 adds canonical TRIALING, access_status/grace_until/billing_anchor_at,
the optional import anchor and subscription.cancelled. Existing fields and event
names remain available. The new SDK snapshot fields are optional so older servers
remain readable. The guide explains paid grace and the distinction between the
collectable status and access_status.

Plan bodies and invoice schemas remain recorded from the previous contract until
backend #215 lands. Synthetic responses in test-vectors/billing are API-shaped
fixtures, never customer traffic or evidence of a real payment. The snapshot pins backend merge `34c862b0bd42bfc5f6e23fa9cb5dd61664162305`.
