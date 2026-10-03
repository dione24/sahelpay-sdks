# SahelPay SDKs Release Checklist

Use this checklist before publishing new versions.

## 1) Security and Secrets

- [ ] Scan repository for hardcoded secrets.
- [ ] Ensure test scripts only use environment variables.
- [ ] Ensure webhook secrets are never logged.

## 2) Build and Packaging

- [ ] JavaScript: `cd javascript && npm install && npm run build`
- [ ] Python: `cd python && python -m py_compile sahelpay/*.py`
- [ ] PHP: `cd php && composer install && ./vendor/bin/phpunit`
- [ ] Verify JS exports include `@sahelpay/sdk` and `@sahelpay/sdk/merchant`.
- [ ] Ensure generated artifacts in `javascript/dist` are in sync with `javascript/src`.

## 3) Contract Parity Smoke Tests

- [ ] JS unit tests: `cd javascript && npm test`
- [ ] Python smoke: `cd python && SAHELPAY_SECRET_KEY=sk_test_xxx python test_sdk.py`
- [ ] PHP webhook smoke: `cd php && ./vendor/bin/phpunit tests/Unit/WebhookTest.php`
- [ ] Sandbox payment with an explicit `X-Idempotency-Key` (required by `POST /v1/payments`); replaying the same key returns the same payment.
- [ ] Simulator run (`mock: true`, amount `4000`, `hosted_checkout: false`) ends `SUCCESS` and delivers a signed `payment.success`.
- [ ] Every SDK helper hits a route that exists in the backend `openapi.json` (known gaps: `plans` / `subscriptions` / `customers` must target `/v1/billing/*`; `refunds.list` has no route; `withdrawals.create` payload; PHP error parsing reads `code`/`message` at the root instead of under `error`).
- [ ] No helper or doc promises removed rails (Wave, Moov, cards), automatic payouts, online refunds, splits or production OPR.

## 4) Documentation

- [ ] Root `README.md` compatibility matrix matches implementation.
- [ ] Language READMEs match actual method signatures and examples.
- [ ] `docs/docs.json` is valid JSON and every navigation entry has a matching `.mdx` page (and vice versa).
- [ ] `docs/resources/changelog.mdx` lists API changes relevant to integrators.
- [ ] Official URLs only: API `https://api.sahelpay.ml`, dashboard `https://app.sahelpay.ml`, docs `https://docs.sahelpay.ml`, payment links `https://pay.sahelpay.ml`.
- [ ] No company identity document (NINA, scans) published anywhere in the docs.
- [ ] Brand assets in `docs/logo` and `docs/favicon.svg` match the official charter (Vert Sahel `#153c32`).
- [ ] Template docs clearly state required production integrations.

## 5) Versioning and Release Notes

- [ ] Bump versions intentionally for changed packages.
- [ ] Add changelog/release notes for contract changes.
- [ ] Tag release in git with matching version semantics.
