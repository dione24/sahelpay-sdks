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
fixtures, never customer traffic or evidence of a real payment. The snapshot pins backend merge `2141bbe2c6274a175e25d2a1e5d3dd1281affd14`.

REL-01 adds409 `INVOICE_PAYMENT_SETTLEMENT_PENDING` at invoice collection boundaries.
A confirmed payment is being settled durably: retrieve payment/invoice state, do not
request another payment. It includes Sarali instructions and public/legacy checkout.
No SDK call or new status is needed; the SDK error code remains an open string.
