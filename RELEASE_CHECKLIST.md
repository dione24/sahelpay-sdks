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

- [ ] JS smoke: `cd javascript && SAHELPAY_SECRET_KEY=sk_test_xxx node test-sdk.ts`
- [ ] Python smoke: `cd python && SAHELPAY_SECRET_KEY=sk_test_xxx python test_sdk.py`
- [ ] PHP webhook smoke: `cd php && ./vendor/bin/phpunit tests/Unit/WebhookTest.php`

## 4) Documentation

- [ ] Root `README.md` compatibility matrix matches implementation.
- [ ] Language READMEs match actual method signatures and examples.
- [ ] Template docs clearly state required production integrations.

## 5) Versioning and Release Notes

- [ ] Bump versions intentionally for changed packages.
- [ ] Add changelog/release notes for contract changes.
- [ ] Tag release in git with matching version semantics.
