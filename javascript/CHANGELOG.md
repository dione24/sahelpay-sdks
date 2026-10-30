# Changelog

## 1.2.0 — 2026-10-30

- Synchronize Billing with backend main: optional phone, customer external/email identity,
  four plan intervals, explicit trials, nullable periods, canonical GET and period import.
- Add invoice create/read/list/open/void/payment-link helpers and preserve pagination.
- Support X-Idempotency-Key on Billing creation helpers; document actual replay guarantees.
- Type Billing webhook payloads, preserve mode, retain timestamped raw-body HMAC verification.
- Add source-derived response fixtures and OpenAPI/type drift checks.
- Document ACTIVE ≠ paid and TEST-mode integration without invented customer contacts.
