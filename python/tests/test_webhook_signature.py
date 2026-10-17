"""Parité de signature avec le serveur SahelPay.

Mêmes vecteurs que la suite jest du serveur (src/webhook/webhook-signature.spec.ts),
le CLI et les SDK JavaScript / PHP : sdks/test-vectors/webhook-signature.json.

    python -m unittest discover -s tests
"""

import hashlib
import hmac
import json
import time
import unittest
from pathlib import Path

import sahelpay

VECTORS = json.loads(
    (Path(__file__).resolve().parents[2] / "test-vectors" / "webhook-signature.json").read_text(encoding="utf-8")
)
NEVER_EXPIRES = 10**12


class WebhookSignatureParityTest(unittest.TestCase):
    def setUp(self):
        self.webhooks = sahelpay.Client(secret_key="sk_test_parity").webhooks

    def test_accepts_server_vectors(self):
        for vector in VECTORS["valid"]:
            with self.subTest(vector["name"]):
                self.assertTrue(
                    self.webhooks.verify_signature(
                        vector["raw_body"], vector["header"], vector["secret"], NEVER_EXPIRES
                    )
                )

    def test_rejects_invalid_vectors(self):
        for vector in VECTORS["invalid"]:
            with self.subTest(vector["name"]):
                self.assertFalse(
                    self.webhooks.verify_signature(
                        vector["raw_body"], vector["header"], vector["secret"], NEVER_EXPIRES
                    )
                )

    def test_rejects_replay_outside_tolerance(self):
        vector = VECTORS["valid"][0]
        self.assertFalse(self.webhooks.verify_signature(vector["raw_body"], vector["header"], vector["secret"]))

    def test_accepts_fresh_signature_computed_like_the_worker(self):
        secret = "whsec_fresh"
        body = json.dumps({"id": "evt_1", "event": "payment.success", "data": {"amount": 4000}}, separators=(",", ":"))
        timestamp = int(time.time())
        digest = hmac.new(secret.encode(), f"{timestamp}.{body}".encode(), hashlib.sha256).hexdigest()
        header = f"t={timestamp},v1={digest}"
        self.assertTrue(self.webhooks.verify_signature(body, header, secret))
        self.assertEqual(self.webhooks.parse_event(body, header, secret).event, "payment.success")


if __name__ == "__main__":
    unittest.main()
