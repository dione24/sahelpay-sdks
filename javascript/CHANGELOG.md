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

## 1.2.0 — 2026-10-30

- Synchronize Billing with backend main: optional phone, customer external/email identity,
  four plan intervals, explicit trials, nullable periods, canonical GET and period import.
- Add invoice create/read/list/open/void/payment-link helpers and preserve pagination.
- Support X-Idempotency-Key on Billing creation helpers; document actual replay guarantees.
- Type Billing webhook payloads, preserve mode, retain timestamped raw-body HMAC verification.
- Add source-derived response fixtures and OpenAPI/type drift checks.
- Document ACTIVE ≠ paid and TEST-mode integration without invented customer contacts.
