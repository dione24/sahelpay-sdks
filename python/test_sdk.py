#!/usr/bin/env python3
"""
Test du SDK SahelPay - Python

Ce script teste les nouvelles fonctionnalités:
- Plans
- Subscriptions
- Customers
"""

from sahelpay import Client
import sys
sys.path.insert(0, '.')


SECRET_KEY = 'sk_live_6w4-GBVyES5vO9BDD7ewa2iXO6FRjkW8'


def test_sdk():
    print('🚀 Test du SDK SahelPay Python\n')
    print('=' * 50)

    client = Client(secret_key=SECRET_KEY, environment='production')

    try:
        # ==================== TEST PLANS ====================
        print('\n📋 TEST: Plans API')
        print('-' * 30)

        # Lister les plans existants
        print('→ Listing des plans...')
        plans = client.plans.list()
        print(f'✅ {len(plans)} plan(s) trouvé(s)')
        for p in plans:
            print(f"   - {p['name']}: {p['amount']} XOF/{p['interval']}")

        # Créer un nouveau plan
        print('\n→ Création d\'un plan de test...')
        import time
        new_plan = client.plans.create(
            name=f'Python SDK Test {int(time.time())}',
            amount=3000,
            interval='MONTHLY',
        )
        print(f"✅ Plan créé: {new_plan['id']}")
        print(f"   Nom: {new_plan['name']}")
        print(
            f"   Montant: {new_plan['amount']} {new_plan.get('currency', 'XOF')}")

        # ==================== TEST SUBSCRIPTIONS ====================
        print('\n📅 TEST: Subscriptions API')
        print('-' * 30)

        # Lister les abonnements
        print('→ Listing des abonnements...')
        subs_result = client.subscriptions.list()
        subs = subs_result.get('subscriptions', [])
        print(f'✅ {len(subs)} abonnement(s) trouvé(s)')

        # Créer un abonnement de test
        print('\n→ Création d\'un abonnement de test...')
        new_sub = client.subscriptions.create(
            plan_id=new_plan['id'],
            customer_phone='22370000003',
        )
        print(f"✅ Abonnement créé: {new_sub['id']}")
        print(f"   Plan: {new_sub.get('plan_name', new_plan['name'])}")
        print(f"   Client: {new_sub['customer_phone']}")
        print(f"   Statut: {new_sub['status']}")
        print(f"   Prochaine facturation: {new_sub['next_billing_date']}")

        # ==================== TEST CUSTOMERS ====================
        print('\n👥 TEST: Customers API')
        print('-' * 30)

        # Lister les clients
        print('→ Listing des clients...')
        customers_result = client.customers.list()
        customers = customers_result.get('customers', [])
        print(f'✅ {len(customers)} client(s) trouvé(s)')

        # ==================== TEST PAYMENT LINKS ====================
        print('\n🔗 TEST: Payment Links API')
        print('-' * 30)

        print('→ Listing des liens de paiement...')
        links = client.payment_links.list()
        print(f'✅ {len(links)} lien(s) de paiement trouvé(s)')

        # ==================== TEST PAYMENTS ====================
        print('\n💳 TEST: Payments API')
        print('-' * 30)

        print('→ Listing des paiements...')
        payments_result = client.payments.list(limit=5)
        payments = payments_result.get('payments', [])
        print(f'✅ {len(payments)} paiement(s) récent(s)')

        # ==================== RÉSUMÉ ====================
        print('\n' + '=' * 50)
        print('✅ TOUS LES TESTS PASSÉS AVEC SUCCÈS!')
        print('=' * 50)

    except Exception as e:
        print(f'\n❌ ERREUR: {e}')
        if hasattr(e, 'code'):
            print(f'   Code: {e.code}')
        if hasattr(e, 'status_code'):
            print(f'   Status: {e.status_code}')


if __name__ == '__main__':
    test_sdk()
