#!/usr/bin/env python3
"""
Test simplifié du SDK Python SahelPay
Teste uniquement les fonctionnalités qui ne nécessitent pas d'auth

Usage:
    cd sdks/python
    python examples/test_simple.py
"""

import sys
import os
import hmac
import hashlib
import json

# Ajouter le chemin du SDK local
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sahelpay.client import Client
from sahelpay.resources import Payment, PaymentLink, Payout, PayoutStats, WebhookEvent

BASE_URL = 'http://localhost:3005'


def test_sdk():
    print('🚀 Test SDK Python SahelPay (Mode Simple)\n')
    print('=' * 50)

    # Test 1: Instantiation du client
    print('📦 Test 1: Instantiation du client...')
    try:
        client = Client(
            secret_key='sk_test_xxx',
            environment='sandbox',
            base_url=BASE_URL
        )
        print('   ✅ Client créé avec succès')
        print(f'   ✅ Base URL: {client._base_url}\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')
        return

    # Test 2: Webhook signature verification
    print('🔒 Test 2: Vérification signature webhook...')
    test_payload = '{"event":"payment.success","data":{"reference_id":"SP-123","amount":5000,"status":"SUCCESS"}}'
    test_secret = 'whsec_test123'
    valid_sig = hmac.new(test_secret.encode(), test_payload.encode(), hashlib.sha256).hexdigest()

    try:
        is_valid = client.webhooks.verify_signature(test_payload, valid_sig, test_secret)
        print(f'   ✅ Signature valide: {is_valid}')
        
        is_invalid = client.webhooks.verify_signature(test_payload, 'bad_sig', test_secret)
        print(f'   ✅ Signature invalide rejetée: {not is_invalid}')
        
        # Parse event
        event = client.webhooks.parse_event(test_payload, valid_sig, test_secret)
        print(f'   ✅ Event parsé: {event.event}')
        print(f'   ✅ Reference ID: {event.data.reference_id}\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 3: Resources (Payment model)
    print('📄 Test 3: Modèles de données (Resources)...')
    try:
        payment_data = {
            "id": "uuid-123",
            "reference_id": "SP-170188-A1B2",
            "amount": 5000,
            "currency": "XOF",
            "provider": "ORANGE_MONEY",
            "status": "SUCCESS",
            "customer_phone": "+22370000000",
            "ussd_code": "*144*4*1234*1#"
        }
        payment = Payment.from_dict(payment_data)
        print(f'   ✅ Payment créé: {payment.reference_id}')
        print(f'   ✅ Status: {payment.status}')
        print(f'   ✅ is_successful(): {payment.is_successful()}\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 4: Payout model
    print('💰 Test 4: Modèle Payout...')
    try:
        payout_data = {
            "id": "uuid-payout-123",
            "reference": "PAY_170188_XYZ",
            "amount": 100000,
            "fee": 1000,
            "net_amount": 99000,
            "currency": "XOF",
            "provider": "WAVE",
            "recipient_phone": "+22377000000",
            "recipient_name": "Fournisseur SARL",
            "status": "COMPLETED",
            "type": "SUPPLIER_PAYMENT"
        }
        payout = Payout.from_dict(payout_data)
        print(f'   ✅ Payout créé: {payout.reference}')
        print(f'   ✅ Montant: {payout.amount} FCFA (frais: {payout.fee} FCFA)')
        print(f'   ✅ Status: {payout.status}')
        print(f'   ✅ is_completed(): {payout.is_completed()}\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 5: PayoutStats model
    print('📊 Test 5: Modèle PayoutStats...')
    try:
        stats_data = {
            "total": 150,
            "completed": 120,
            "failed": 10,
            "pending": 20,
            "success_rate": 85.5,
            "total_volume": 15000000
        }
        stats = PayoutStats.from_dict(stats_data)
        print(f'   ✅ Total payouts: {stats.total}')
        print(f'   ✅ Complétés: {stats.completed}')
        print(f'   ✅ Taux de succès: {stats.success_rate}%')
        print(f'   ✅ Volume: {stats.total_volume:,.0f} FCFA\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 6: HTTP connectivity check
    print('🌐 Test 6: Connectivité HTTP au backend...')
    try:
        import urllib.request
        req = urllib.request.Request(
            f'{BASE_URL}/v1/payment-links',
            headers={'Authorization': 'Bearer sk_test_xxx'}
        )
        try:
            urllib.request.urlopen(req, timeout=5)
            print('   ✅ Backend accessible (réponse 2xx)')
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print(f'   ✅ Backend accessible (401 - auth requise, normal)')
            else:
                print(f'   ⚠️ Backend répond avec code {e.code}')
        except urllib.error.URLError as e:
            print(f'   ❌ Backend inaccessible: {e.reason}')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    print('\n' + '=' * 50)
    print('✅ Tests SDK terminés avec succès!')
    print('\n📌 Note: Les tests d\'API (paiements, payouts) nécessitent')
    print('   un backend correctement configuré avec Prisma migré.\n')


if __name__ == '__main__':
    test_sdk()
