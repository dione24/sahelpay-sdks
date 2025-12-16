#!/usr/bin/env python3
"""
Test local du SDK Python SahelPay

Usage:
    cd sdks/python
    pip install -e .
    python examples/test_local.py
"""

import sys
import os

# Ajouter le chemin du SDK local
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sahelpay.client import Client
from sahelpay.exceptions import SahelPayError, APIError
import hmac
import hashlib

# Clé secrète du marchand SahelPay Demo (déchiffrée)
API_KEY = 'sk_test_SAHEL_123'
BASE_URL = 'http://localhost:3005'  # Backend Docker port


def test_sdk():
    print('🚀 Test SDK Python SahelPay\n')
    print('=' * 50)

    # Initialisation
    client = Client(
        secret_key=API_KEY,
        environment='sandbox',
        base_url=BASE_URL
    )

    print('✅ Client initialisé')
    print(f'   Base URL: {BASE_URL}')
    print('   Mode: sandbox\n')

    # Test 1: Lister les transactions
    print('📋 Test 1: Lister les transactions...')
    try:
        result = client.payments.list(limit=5)
        payments = result.get('payments', [])
        print(f'   ✅ {len(payments)} transactions trouvées\n')
    except SahelPayError as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 2: Lister les liens de paiement
    print('🔗 Test 2: Lister les liens de paiement...')
    try:
        links = client.payment_links.list()
        print(f'   ✅ {len(links)} liens trouvés\n')
    except SahelPayError as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 3: Stats Payouts
    print('💰 Test 3: Statistiques payouts...')
    try:
        stats = client.payouts.stats()
        print(f'   ✅ Total: {stats.total}')
        print(f'   ✅ Complétés: {stats.completed}')
        print(f'   ✅ Volume: {stats.total_volume} FCFA\n')
    except SahelPayError as e:
        print(f'   ❌ Erreur: {e}\n')

    # Test 4: Initier un paiement (simulation)
    print('💳 Test 4: Initier un paiement...')
    try:
        payment = client.payments.create(
            amount=1000,
            provider='ORANGE_MONEY',
            customer_phone='+22370000000',
            description='Test SDK Python'
        )
        print(f'   ✅ Paiement créé: {payment.reference_id}')
        print(f'   ✅ Status: {payment.status}')
        print(f'   ✅ USSD: {payment.ussd_code or "N/A"}\n')
    except SahelPayError as e:
        print(f'   ⚠️ Erreur attendue (pas de marchand): {e}\n')

    # Test 5: Webhook verification
    print('🔒 Test 5: Vérification signature webhook...')
    test_payload = '{"event":"payment.success","data":{"amount":1000}}'
    test_secret = 'whsec_test123'
    try:
        # Générer une signature valide
        valid_sig = hmac.new(
            test_secret.encode(),
            test_payload.encode(),
            hashlib.sha256
        ).hexdigest()

        is_valid = client.webhooks.verify_signature(test_payload, valid_sig, test_secret)
        print(f'   ✅ Signature valide: {is_valid}')

        is_invalid = client.webhooks.verify_signature(test_payload, 'bad_signature', test_secret)
        print(f'   ✅ Signature invalide rejetée: {not is_invalid}\n')
    except Exception as e:
        print(f'   ❌ Erreur: {e}\n')

    print('=' * 50)
    print('✅ Tests terminés!\n')


if __name__ == '__main__':
    test_sdk()
