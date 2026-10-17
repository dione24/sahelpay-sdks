"""Tests hors réseau des contrats SDK Python (mock de Client._request)."""

import json
import unittest
from unittest.mock import patch

from sahelpay.client import Client
from sahelpay.resources import Payment, WebhookEvent
from sahelpay.capabilities import CAPABILITIES, has_capability


def _ok(data):
    return {"success": True, "data": data}


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.client = Client(secret_key="sk_test_123")

    def test_payments_create_sends_items_urls_and_idempotency(self):
        captured = {}

        def fake_request(method, path, data=None, headers=None):
            captured.update(method=method, path=path, data=data, headers=headers)
            return _ok({
                "id": "pi_1",
                "status": "INITIATED",
                "checkout_url": "https://pay.sahelpay.ml/c/pi_1",
                "client_reference": "order-1",
            })

        with patch.object(self.client, "_request", side_effect=fake_request):
            payment = self.client.payments.create(
                amount=2500,
                provider="ORANGE_MONEY",
                customer_phone="+22370000000",
                client_reference="order-1",
                success_url="https://shop.test/ok",
                cancel_url="https://shop.test/ko",
                hosted_checkout=True,
                items=[{"product_id": "prod_1", "quantity": 2}],
                idempotency_key="order-1",
            )

        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["path"], "/v1/payments")
        self.assertEqual(captured["headers"]["X-Idempotency-Key"], "order-1")
        self.assertEqual(captured["data"]["items"], [{"product_id": "prod_1", "quantity": 2}])
        self.assertEqual(captured["data"]["client_reference"], "order-1")
        self.assertEqual(captured["data"]["success_url"], "https://shop.test/ok")
        self.assertEqual(captured["data"]["cancel_url"], "https://shop.test/ko")
        self.assertTrue(captured["data"]["hosted_checkout"])
        self.assertEqual(payment.checkout_url, "https://pay.sahelpay.ml/c/pi_1")

    def test_payments_create_generates_idempotency_header(self):
        captured = {}

        def fake_request(method, path, data=None, headers=None):
            captured["headers"] = headers
            return _ok({"id": "pi_2", "status": "INITIATED"})

        with patch.object(self.client, "_request", side_effect=fake_request):
            self.client.payments.create(
                amount=1000, provider="ORANGE_MONEY", customer_phone="+22370000000"
            )
        self.assertRegex(captured["headers"]["X-Idempotency-Key"], r"^sdk_")

    def test_withdrawals_create_real_contract(self):
        captured = {}

        def fake_request(method, path, data=None, headers=None):
            captured.update(method=method, path=path, data=data, headers=headers)
            return _ok({"id": "wd_1"})

        with patch.object(self.client, "_request", side_effect=fake_request):
            self.client.withdrawals.create(
                amount=50000,
                phone_number="+22370000000",
                idempotency_key="wd-1",
            )

        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["path"], "/v1/withdrawals")
        self.assertEqual(captured["data"], {
            "amount": 50000,
            "phone_number": "+22370000000",
            "provider": "ORANGE_MONEY",
        })
        self.assertEqual(captured["headers"]["X-Idempotency-Key"], "wd-1")

    def test_billing_and_refunds_paths(self):
        calls = []

        def fake_request(method, path, data=None, headers=None):
            calls.append((method, path, data, headers))
            return _ok({"id": "x"})

        with patch.object(self.client, "_request", side_effect=fake_request):
            self.client.plans.create(name="Premium", amount=10000, interval="MONTHLY")
            self.client.subscriptions.create_with_payment(
                plan_id="plan_1", customer_phone="+22370000000"
            )
            self.client.customers.list(search="7012", page=1, limit=20)
            self.client.refunds.create(
                payment_id="pi_1", amount=1000, idempotency_key="rf-1"
            )
            self.client.portal.create_session(customer_phone="+22370000000")

        self.assertEqual(calls[0][0:2], ("POST", "/v1/billing/plans"))
        self.assertEqual(calls[1][0:2], ("POST", "/v1/billing/subscriptions/with-payment"))
        self.assertEqual(calls[2][0], "GET")
        self.assertIn("/v1/billing/customers?", calls[2][1])
        self.assertIn("search=7012", calls[2][1])
        self.assertEqual(calls[3][0:2], ("POST", "/v1/refunds"))
        self.assertEqual(calls[3][3]["X-Idempotency-Key"], "rf-1")
        self.assertFalse(hasattr(self.client.refunds, "list"))
        self.assertEqual(calls[4][0:2], ("POST", "/v1/portal/sessions"))

    def test_payouts_emit_deprecation_warning(self):
        def fake_request(method, path, data=None, headers=None):
            return _ok({"id": "po_1"})

        with patch.object(self.client, "_request", side_effect=fake_request):
            with self.assertWarns(DeprecationWarning):
                self.client.payouts.create(
                    amount=1000,
                    provider="ORANGE_MONEY",
                    recipient_phone="+22370000000",
                )

    def test_capabilities_orange_money_only(self):
        self.assertEqual(list(CAPABILITIES.keys()), ["ORANGE_MONEY"])
        self.assertTrue(has_capability("ORANGE_MONEY", "payments"))
        self.assertFalse(has_capability("ORANGE_MONEY", "payouts"))
        self.assertTrue(has_capability("ORANGE_MONEY", "withdrawals"))

    def test_construct_event_converts_only_payment_events(self):
        payment_payload = json.dumps({
            "id": "evt_1",
            "event": "payment.success",
            "data": {"id": "pi_1", "amount": 1000, "status": "SUCCESS", "currency": "XOF"},
            "timestamp": "2026-01-01T00:00:00Z",
        })
        invoice_payload = json.dumps({
            "id": "evt_2",
            "event": "invoice.paid",
            "data": {"id": "inv_1", "total": 10000},
            "timestamp": "2026-01-01T00:00:00Z",
        })

        with patch.object(self.client.webhooks, "verify_signature", return_value=True):
            payment_event = self.client.webhooks.construct_event(payment_payload, "t=1,v1=x", "whsec")
            invoice_event = self.client.webhooks.construct_event(invoice_payload, "t=1,v1=x", "whsec")

        self.assertIsInstance(payment_event, WebhookEvent)
        self.assertIsInstance(payment_event.data, Payment)
        self.assertEqual(payment_event.data.id, "pi_1")
        self.assertIsInstance(invoice_event.data, dict)
        self.assertEqual(invoice_event.data["id"], "inv_1")


if __name__ == "__main__":
    unittest.main()
