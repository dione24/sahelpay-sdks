# SahelPay SDK for Python

SDK officiel pour intégrer les paiements SahelPay dans vos applications Python.

## Installation

```bash
pip install sahelpay
```

> Note: tant que le package n’est pas publié sur PyPI, installez-le depuis ce monorepo.
> Voir `../README.md` (racine du repo) pour la procédure (ex: `pip install -e .`).

## Démarrage rapide

```python
import sahelpay

# Initialiser le client
client = sahelpay.Client(
    secret_key="sk_live_xxx",  # Votre clé secrète
    environment="production"    # ou "sandbox" pour les tests
)

# Créer un paiement
payment = client.payments.create(
    amount=5000,
    currency="XOF",
    provider="ORANGE_MONEY",
    customer_phone="+22370000000",
    description="Commande #123"
)

print(f"Référence: {payment.reference_id}")
print(f"Code USSD: {payment.ussd_code}")
```

## Providers supportés

| Provider     | Code           | Pays                                  |
| ------------ | -------------- | ------------------------------------- |
| Orange Money | `ORANGE_MONEY` | Mali, Sénégal, Côte d'Ivoire, Burkina |
| Wave         | `WAVE`         | Mali, Sénégal, Côte d'Ivoire          |
| Moov Money   | `MOOV`         | Mali, Côte d'Ivoire, Burkina, Niger   |

## API Reference

### Paiements

```python
# Créer un paiement
payment = client.payments.create(
    amount=5000,
    currency="XOF",
    provider="ORANGE_MONEY",
    customer_phone="+22370000000",
    description="Commande #123",
    metadata={"order_id": "123"},
    callback_url="https://votre-site.com/webhook",
    return_url="https://votre-site.com/success"
)

# Vérifier le statut
result = client.payments.check_status("SP_xxx")
print(result["status"])  # 'SUCCESS' | 'PENDING' | 'FAILED'

# Récupérer un paiement
payment = client.payments.retrieve("SP_xxx")

# Lister les paiements
result = client.payments.list(limit=20, page=1, status="SUCCESS")
for payment in result["payments"]:
    print(f"{payment.reference_id}: {payment.amount} XOF")
```

### Liens de paiement

```python
# Créer un lien de paiement
link = client.payment_links.create(
    title="Formation Python",
    price=25000,
    currency="XOF",
    redirect_url="https://votre-site.com/merci"
)

print(f"URL: {link.url}")

# Lister les liens
links = client.payment_links.list()

# Désactiver un lien
client.payment_links.deactivate("link_id")
```

### Payouts (Envoi d'argent)

```python
# Envoyer de l'argent
payout = client.payouts.create(
    amount=100000,
    provider="WAVE",
    recipient_phone="+22377000000",
    recipient_name="Fournisseur SARL",
    description="Paiement facture #456",
    payout_type="SUPPLIER_PAYMENT"  # Optionnel
)

print(f"Référence: {payout.reference}")
print(f"Statut: {payout.status}")  # PENDING | PROCESSING | COMPLETED | FAILED

# Récupérer un payout
payout = client.payouts.retrieve("PAY_xxx")

# Lister les payouts
result = client.payouts.list(limit=20, status="COMPLETED")
for p in result["payouts"]:
    print(f"{p.reference}: {p.amount} XOF -> {p.recipient_phone}")

# Annuler un payout en attente
client.payouts.cancel("PAY_xxx")

# Statistiques
stats = client.payouts.stats()
print(f"Volume total: {stats.total_volume} XOF")
print(f"Taux de succès: {stats.success_rate}%")
```

### Webhooks

```python
from flask import Flask, request
import sahelpay

app = Flask(__name__)
client = sahelpay.Client(secret_key="sk_live_xxx")

@app.route("/webhook", methods=["POST"])
def webhook():
    payload = request.data.decode("utf-8")
    signature = request.headers.get("X-SahelPay-Signature")
    webhook_secret = "whsec_xxx"  # Votre secret webhook

    try:
        event = client.webhooks.parse_event(payload, signature, webhook_secret)

        if event.event == "payment.success":
            print(f"Paiement réussi: {event.data.reference_id}")
            # Mettre à jour votre commande
        elif event.event == "payment.failed":
            print(f"Paiement échoué: {event.data.reference_id}")

        return {"received": True}
    except sahelpay.SahelPayError as e:
        print(f"Webhook error: {e}")
        return {"error": str(e)}, 400
```

## Intégration Django

```python
# views.py
import sahelpay
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

client = sahelpay.Client(secret_key=settings.SAHELPAY_SECRET_KEY)

def create_checkout(request):
    """Créer un checkout pour une commande"""
    order = Order.objects.get(id=request.POST["order_id"])

    payment = client.payments.create(
        amount=order.total,
        provider=request.POST["provider"],
        customer_phone=request.POST["phone"],
        description=f"Commande #{order.id}",
        metadata={"order_id": str(order.id)},
        return_url=f"{settings.SITE_URL}/orders/{order.id}/confirm/"
    )

    order.payment_reference = payment.reference_id
    order.save()

    return JsonResponse({
        "reference": payment.reference_id,
        "ussd_code": payment.ussd_code,
    })

@csrf_exempt
def webhook(request):
    """Recevoir les notifications de paiement"""
    payload = request.body.decode("utf-8")
    signature = request.headers.get("X-SahelPay-Signature")

    try:
        event = client.webhooks.parse_event(
            payload,
            signature,
            settings.SAHELPAY_WEBHOOK_SECRET
        )

        if event.event == "payment.success":
            order = Order.objects.get(
                payment_reference=event.data.reference_id
            )
            order.status = "paid"
            order.save()

        return JsonResponse({"received": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)
```

## Intégration FastAPI

```python
from fastapi import FastAPI, Request, HTTPException
import sahelpay

app = FastAPI()
client = sahelpay.Client(secret_key="sk_live_xxx")

@app.post("/checkout")
async def create_checkout(
    amount: float,
    phone: str,
    provider: str = "ORANGE_MONEY"
):
    try:
        payment = client.payments.create(
            amount=amount,
            provider=provider,
            customer_phone=phone,
            description="Achat en ligne"
        )
        return {"payment": payment.__dict__}
    except sahelpay.SahelPayError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/webhook")
async def webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-SahelPay-Signature")

    try:
        event = client.webhooks.parse_event(
            payload.decode(),
            signature,
            "whsec_xxx"
        )
        # Traiter l'événement...
        return {"received": True}
    except sahelpay.SahelPayError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## Gestion des erreurs

```python
import sahelpay

try:
    payment = client.payments.create(...)
except sahelpay.AuthenticationError as e:
    print(f"Clé API invalide: {e}")
except sahelpay.ValidationError as e:
    print(f"Paramètres invalides: {e}")
except sahelpay.APIError as e:
    print(f"Erreur API: {e.code} - {e.message}")
except sahelpay.SahelPayError as e:
    print(f"Erreur: {e}")
```

## Async Support

Pour les applications async, utilisez `httpx` ou `aiohttp` :

```python
import httpx
import sahelpay

async def create_payment_async():
    async with httpx.AsyncClient() as http:
        response = await http.post(
            "https://api.sahelpay.ml/v1/payments",
            headers={"Authorization": f"Bearer {secret_key}"},
            json={
                "amount": 5000,
                "provider": "ORANGE_MONEY",
                "customer_phone": "+22370000000"
            }
        )
        return response.json()
```

## Support

- Documentation: https://docs.sahelpay.ml
- Email: dev@sahelpay.ml
- GitHub Issues: https://github.com/sahelpay/sahelpay-python/issues

## License

MIT
