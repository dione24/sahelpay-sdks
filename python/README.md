# SahelPay SDK for Python

SDK officiel pour intégrer les paiements SahelPay (Orange Money, Mali) dans vos applications Python 3.8+. Documentation : https://docs.sahelpay.ml

## Installation

Le paquet `sahelpay` n'est pas encore publié sur PyPI. Installez-le depuis ce dépôt :

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/python
pip install -e .
```

## Démarrage rapide

```python
import sahelpay

client = sahelpay.Client(secret_key="sk_test_xxx")  # https://api.sahelpay.ml dans tous les cas

payment = client.payments.create(
    amount=5000,
    currency="XOF",
    provider="ORANGE_MONEY",          # seul moyen de paiement
    customer_phone="+22370000000",
    description="Commande #123",
    client_reference="order-123",
    return_url="https://votre-site.com/merci?order=order-123",
    idempotency_key="order-123",      # obligatoire côté API
)

print(payment.id)
print(payment.redirect_url)  # checkout SahelPay (hosted_checkout=True par défaut)
```

Points clés :

- **Orange Money est le seul moyen de paiement** ; tout autre `provider` est rejeté (`400`).
- `X-Idempotency-Key` est obligatoire côté API. Sans `idempotency_key`, le SDK génère une clé aléatoire à chaque appel : un retry créerait alors un second paiement. Passez une clé stable liée à votre commande.
- Après un paiement confirmé, le client est renvoyé automatiquement vers `return_url` (HTTPS, hors domaines SahelPay).
- `items` (Partenaires SPAY) n'est pas encore exposé : utilisez l'API HTTP pour ces paiements.

## Sandbox et production

- **Sandbox** (`sk_test_...`) : gratuite, sans abonnement.
- **Production** (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay et **abonnement SahelPay payé en cours** (`403 PAID_SUBSCRIPTION_REQUIRED` sinon). Plafond mensuel live selon le forfait (200 000 FCFA pour Starter et Pro).

## Tests

Deux options, réservées aux clés de test :

- `mock=True` → simulateur SahelPay, aucun appel opérateur. Statut final selon le montant : `4000` réussi, `4001` échoué, `4002` en attente, `4003` erreur opérateur.
- `sandbox=True` → environnement de test d'Orange.

```python
payment = client.payments.create(
    amount=4000,
    provider="ORANGE_MONEY",
    customer_phone="+22370000000",
    hosted_checkout=False,  # la simulation démarre à l'initiation
    mock=True,
    idempotency_key="test-4000-1",
)

result = client.payments.check_status(payment.id)
print(result["status"])  # SUCCESS

client.webhooks.test()  # envoie webhook.test vers l'URL configurée
```

## API Reference

### Paiements

```python
result = client.payments.check_status(payment.id)
print(result["status"])  # INITIATED | PENDING | SUCCESS | FAILED | EXPIRED

payment = client.payments.retrieve(payment.id)       # GET /v1/payments/{id}/status
by_order = client.payments.search("order-123")       # None si introuvable
details = client.payments.details(payment.id)
client.payments.reconcile(payment.id)
final = client.payments.poll(payment.id)
```

> `payments.list()` lit `GET /v1/payments/history`, qui ne contient pas les paiements créés via `POST /v1/payments`.

### Liens de paiement

```python
link = client.payment_links.create(
    title="Formation Python",
    price=25000,
    redirect_url="https://votre-site.com/merci",
)
print(link.url)  # https://pay.sahelpay.ml/<slug>

links = client.payment_links.list()
client.payment_links.deactivate(link.id)
```

### Retraits

Demandes de retrait **traitées manuellement** par SahelPay (minimum 50 000 FCFA, frais 1 % minimum 100 FCFA).

```python
balance = client.withdrawals.balance()
quote = client.withdrawals.quote(50000)
withdrawal = client.withdrawals.create(
    amount=50000,
    phone_number="+22370000000",
    quoted_fee=quote.get("fee"),
    idempotency_key="wd-order-1",
)
client.withdrawals.cancel("withdrawal_id")  # demande encore PENDING

### Webhooks

```python
from flask import Flask, request
import sahelpay

app = Flask(__name__)
client = sahelpay.Client(secret_key="sk_live_xxx")

@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.get_data(as_text=True)  # corps brut
    signature = request.headers.get("X-SahelPay-Signature", "")

    try:
        event = client.webhooks.construct_event(payload, signature, WEBHOOK_SECRET)
    except sahelpay.SahelPayError:
        return {"error": "Invalid signature"}, 400

    if event.event == "payment.success":
        order_id = event.data.client_reference
        # Mettre à jour la commande
    elif event.event in ("payment.failed", "payment.expired"):
        pass

    return {"received": True}
```

Événements émis : `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated`, `secure_order.*`, `invoice.created`, `invoice.paid`, `subscription.payment_due`, `subscription.renewed`, `webhook.test`. `construct_event()` convertit `data` en `Payment` uniquement pour `payment.*` ; le reste reste un dict.

### Customer Portal

```python
session = client.portal.create_session(
    customer_phone="+22370000000",
    return_url="https://votre-site.com/compte",
)
# Rediriger le client vers session["url"]
```

## Helpers à éviter pour l'instant

| Helper | Raison |
| --- | --- |
| `payouts.*` | Payouts automatiques indisponibles côté API |
| `refunds.*` | Remboursements en ligne désactivés (`503`), passer par le support |
| `has_capability()` & co. | Table statique : seul Orange Money, sans payouts automatiques |
| `GatewayStream` | Flux réservé à l'administration SahelPay |

## Gestion des erreurs

```python
import sahelpay

try:
    payment = client.payments.create(...)
except sahelpay.AuthenticationError as e:   # 401
    print(f"Clé API invalide: {e.code}")
except sahelpay.ValidationError as e:       # 400
    print(f"Paramètres invalides: {e.code} - {e.message}")
except sahelpay.APIError as e:              # autres statuts (403 plafond/abonnement, 409, 503…)
    print(f"Erreur API: {e.code} - {e.message}")
except sahelpay.SahelPayError as e:
    print(f"Erreur: {e}")
```

## Support

- Documentation : https://docs.sahelpay.ml
- Email : support@sahelpay.africa
- GitHub Issues : https://github.com/dione24/sahelpay-sdks/issues

## License

MIT
