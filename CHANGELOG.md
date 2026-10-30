# Changelog

## 1.3.0 — 2026-10-30

- Add canonical trial/access/grace/calendar fields and subscription.cancelled.
- Add read-only application-scoped reminder preview, nullable email rendering,
  existing-key authentication and TEST-only preview semantics; no sends or activation.
- Add take/cursor SQL pagination across Billing lists, preserving existing returns;
  JS plans.listPage / Python plans.list_page expose outer pagination.
- Document persistent creation idempotency and nullable settled send-link replays.
- Validate all Billing OpenAPI operation bodies/responses and shared fixtures.
- Keep 1.2.0 tags immutable. Source release only until registry access is restored.

## JavaScript, Python, PHP 1.2.0 — 2026-10-30

Billing contract sync: optional phone, external reference/email identities, trials,
periods, canonical subscription GET/import, invoices and pagination. Billing creation
accepts idempotency headers; backend-specific guarantees are documented. Typed Billing
webhook payloads retain signed raw-body verification and event mode. Unit fixtures,
OpenAPI/type contract checks and bilingual Mintlify guide included. PHP requires 8.1+
(the pre-existing HTTP client uses `never`). Python/PHP remain source installs until
registry credentials and compatible package registration are configured.
