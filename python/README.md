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
- **Production** (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay. Inscription gratuite et sans abonnement : SahelPay facture une commission par transaction réussie. Pas de plafond de forfait : seuls les plafonds KYC s'appliquent.

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
    name="Formation Python",
    fixed_amount=25000,  # prix imposé (amount_mode FIXED)
    success_redirect_url="https://votre-site.com/merci",
)
print(link.url)  # https://pay.sahelpay.africa/<slug>

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

Événements émis : `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated`, `secure_order.*`, `invoice.created`, `invoice.paid`, `subscription.payment_due`, `subscription.renewed`, `subscription.cancelled`, `webhook.test`. `construct_event()` convertit `data` en `Payment` uniquement pour `payment.*` ; le reste reste un dict.

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
except sahelpay.APIError as e:              # autres statuts (403 plafond/accès production, 409, 503…)
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

## Billing 1.3.0

```python
result = client.subscriptions.create_with_payment(
    plan_id="PLAN_ID", customer_external_ref="test_user_PLACEHOLDER",
    external_ref="test_checkout_PLACEHOLDER", idempotency_key="test_checkout_PLACEHOLDER",
)
current = client.subscriptions.retrieve(result["subscription"]["id"])
page = client.invoices.list(subscription_id=current["id"], limit=20, offset=0)
# page["invoices"], page["pagination"]
```

Le téléphone est facultatif avec une autre identité client. `trial_end` crée un essai
avec facture/lien null ; les périodes peuvent être null pour les anciennes lignes.
Le statut de création seul ne prouve pas un paiement : le GET canonique distingue
ACTIVE payé et TRIALING en essai ; relire abonnement/facture avant les droits payés. Les clés
`idempotency_key` passent en header : les six créations Billing sont dédupliquées
durablement par clé/corps (409 IDEMPOTENCY_KEY_REUSED si le corps change). Sans clé,
seuls checkout/import gardent leur référence naturelle. Les listes acceptent take/cursor ;
page/limit clients et limit/offset factures restent disponibles. Guide français/anglais :
https://docs.sahelpay.ml/guides/subscriptions

Phone is optional with another identity. Trial checkouts have no invoice/payment
link. A creation status is not payment proof; canonical ACTIVE is a current paid period. Verify signatures, deduplicate event IDs and
retrieve canonical state. Manual Orange Money renewal only, no automatic debit.

Types importables : `sahelpay.billing` (TypedDict, Literal). Les réponses restent des dictionnaires.

### Cycle Billing après backend #214

Le GET canonique distingue `ACTIVE` (période payée) et `TRIALING` (essai). Une
création d’essai conserve sa réponse historique ACTIVE avec trial_end : relire
le GET. Après l’échéance payée, trois jours de grâce puis access_status EXPIRED ;
status reste PAST_DUE pour le règlement. Aucun jour de grâce après un essai.
`subscription.cancelled` signale l’annulation immédiate avec un event.id stable.
Les nouveaux champs SDK sont facultatifs pour les anciens serveurs.
Voir le guide Billing pour l’ancre UTC et les frontières temporelles.

Canonical GET now distinguishes paid ACTIVE from TRIALING. Paid grace lasts
three days; access_status becomes EXPIRED while status remains collectable
PAST_DUE. Trials have no grace. Historical trial creation still returns ACTIVE
with trial_end; retrieve the canonical snapshot before access decisions. New
fields remain optional for older servers; subscription.cancelled signals
immediate cancellation with a stable event ID.
