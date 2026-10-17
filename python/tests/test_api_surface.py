"""Contrats hors réseau ajoutés en 1.1.0 : chaque appel vise une route réelle de l'API."""

import hashlib
import hmac
import unittest
import warnings
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from sahelpay.client import Client
from sahelpay.resources import PaymentLink, WebhookEvent


class _Recorder:
    def __init__(self, data=None):
        self.calls = []
        self.data = data if data is not None else {"id": "x", "slug": "abc"}

    def __call__(self, method, path, data=None, headers=None):
        self.calls.append({"method": method, "path": path, "data": data, "headers": headers})
        return {"success": True, "data": self.data}


class ApiSurfaceTests(unittest.TestCase):
    def setUp(self):
        self.client = Client(secret_key="sk_test_123")

    def _record(self, data=None):
        recorder = _Recorder(data)
        patcher = patch.object(self.client, "_request", side_effect=recorder)
        patcher.start()
        self.addCleanup(patcher.stop)
        return recorder

    def test_description_is_sent_at_the_root(self):
        rec = self._record({"id": "pi_1"})
        payment = self.client.payments.create(amount=1000, customer_phone="+22370000000", description="Commande 42")
        body = rec.calls[0]["data"]
        self.assertEqual(body["description"], "Commande 42")
        self.assertNotIn("description", body.get("metadata", {}))
        self.assertEqual(payment.description, "Commande 42")

    def test_hosted_checkout_without_phone_and_no_nulls(self):
        rec = self._record({"id": "pi_2"})
        payment = self.client.payments.create(amount=1000, client_reference="ORDER-2")
        body = rec.calls[0]["data"]
        self.assertNotIn("customer", body)
        self.assertNotIn(None, body.values())
        self.assertEqual(payment.client_reference, "ORDER-2")

    def test_callback_url_is_deprecated_and_not_sent(self):
        rec = self._record({"id": "pi_3"})
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            self.client.payments.create(amount=1000, customer_phone="+22370000000", callback_url="https://x.test/cb")
        self.assertTrue(any(issubclass(w.category, DeprecationWarning) for w in caught))
        self.assertNotIn("callback_url", str(rec.calls[0]["data"]))

    def test_query_values_are_url_encoded(self):
        rec = self._record({})
        self.client.payments.recommend("+22370000000")
        self.client.payments.search("order #1&x")
        self.assertEqual(parse_qs(urlsplit(rec.calls[0]["path"]).query), {"phone": ["+22370000000"]})
        self.assertEqual(parse_qs(urlsplit(rec.calls[1]["path"]).query), {"client_reference": ["order #1&x"]})

    def test_expire(self):
        rec = self._record({})
        self.client.payments.expire("pi_9")
        self.assertEqual((rec.calls[0]["method"], rec.calls[0]["path"]), ("POST", "/v1/payments/pi_9/expire"))

    def test_legacy_price_link_is_fixed(self):
        rec = self._record()
        link = self.client.payment_links.create(title="T-shirt", price=5000)
        body = rec.calls[0]["data"]
        self.assertEqual(body["amount_mode"], "FIXED")
        self.assertEqual(body["fixed_amount"], 5000)
        self.assertEqual(link.url, "https://pay.sahelpay.africa/abc")

    def test_link_without_amount_is_open(self):
        rec = self._record()
        self.client.payment_links.create(name="Caisse", min_amount=500)
        self.assertEqual(rec.calls[0]["data"]["amount_mode"], "OPEN")

    def test_link_update_delete_by_id(self):
        rec = self._record()
        self.client.payment_links.update("pl_1", name="Nouveau")
        self.client.payment_links.delete("pl_1")
        self.client.payment_links.retrieve_by_id("pl_1")
        self.assertEqual([(c["method"], c["path"]) for c in rec.calls], [
            ("PATCH", "/v1/payment-links/pl_1"),
            ("DELETE", "/v1/payment-links/pl_1"),
            ("GET", "/v1/payment-links/by-id/pl_1"),
        ])

    def test_open_link_with_null_price_parses(self):
        link = PaymentLink.from_dict({"id": "pl", "slug": "s", "name": "Caisse", "amount_mode": "OPEN", "price": None, "fixed_amount": None})
        self.assertIsNone(link.price)
        self.assertEqual(link.name, "Caisse")

    def test_webhook_logs_retry_events(self):
        rec = self._record([])
        self.client.webhooks.list_logs(status="FAILED", limit=10)
        self.client.webhooks.retry("log_1")
        self.client.webhooks.list_events(limit=5)
        self.assertEqual(urlsplit(rec.calls[0]["path"]).path, "/v1/webhooks/logs")
        self.assertEqual(parse_qs(urlsplit(rec.calls[0]["path"]).query), {"status": ["FAILED"], "limit": ["10"]})
        self.assertEqual((rec.calls[1]["method"], rec.calls[1]["path"]), ("POST", "/v1/webhooks/logs/log_1/retry"))
        self.assertEqual(rec.calls[2]["path"], "/v1/webhooks/events?limit=5")

    def test_secure_orders(self):
        rec = self._record({"id": "so_1"})
        self.client.secure_orders.create(amount=15000, description="Robe wax", customer_phone="+22370000000", idempotency_key="order-9")
        self.client.secure_orders.confirm_delivery("so_1", "482913")
        self.assertEqual(rec.calls[0]["path"], "/v1/secure-orders")
        self.assertEqual(rec.calls[0]["headers"], {"X-Idempotency-Key": "order-9"})
        self.assertEqual(rec.calls[1]["path"], "/v1/secure-orders/so_1/confirm-delivery")
        self.assertEqual(rec.calls[1]["data"], {"code": "482913"})

    def test_bare_body_hmac_is_rejected(self):
        payload = '{"id":"evt_1","event":"payment.success"}'
        legacy = hmac.new(b"whsec_test", payload.encode(), hashlib.sha256).hexdigest()
        self.assertFalse(self.client.webhooks.verify_signature(payload, legacy, "whsec_test"))

    def test_webhook_event_exposes_id(self):
        event = WebhookEvent.from_dict({"id": "evt_1", "event": "refund.pending", "version": "v1", "timestamp": "t", "data": {}})
        self.assertEqual((event.id, event.version), ("evt_1", "v1"))


class ConfigTests(unittest.TestCase):
    def test_sandbox_environment_uses_api_host(self):
        client = Client(secret_key="sk_test_123", environment="sandbox")
        self.assertEqual(client._base_url, "https://api.sahelpay.ml")


if __name__ == "__main__":
    unittest.main()
