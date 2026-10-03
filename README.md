# SahelPay SDKs (monorepo)

Ce dépôt regroupe les SDKs officiels SahelPay pour intégrer l'API SahelPay (paiements Orange Money, liens de paiement, webhooks, retraits) dans vos applications. Documentation complète : [docs.sahelpay.ml](https://docs.sahelpay.ml).

> Statut : **en cours de packaging**. Les SDKs ne sont pas encore publiés sur npm / Packagist / PyPI.
> En attendant, **clonez ce dépôt** et installez chaque SDK en local.

## Table des matières

- [Packages](#packages)
- [Ce qui est disponible côté API](#ce-qui-est-disponible-côté-api)
- [Compatibilité (features par SDK)](#compatibilité-features-par-sdk)
- [Concepts communs](#concepts-communs)
- [Installation depuis ce repo](#installation-depuis-ce-repo)
- [Quickstarts](#quickstarts)
- [Exemples](#exemples)
- [Validation de parité contractuelle (smoke)](#validation-de-parité-contractuelle-smoke)
- [FAQ / Troubleshooting](#faq--troubleshooting)

## Packages

- **JavaScript/TypeScript** : `./javascript` (package cible : `@sahelpay/sdk`)
- **PHP/Laravel** : `./php` (package cible : `sahelpay/sahelpay-php`)
- **Python** : `./python` (package cible : `sahelpay`)
- **Documentation Mintlify** (docs.sahelpay.ml) : `./docs`
- **Exemples** : `./examples`, `./templates`

## Ce qui est disponible côté API

- **Orange Money (Mali) est le seul moyen de paiement.** Wave, Moov, les cartes et les autres agrégateurs ont été retirés : tout autre `provider` est rejeté (`400`).
- **Sandbox gratuite** avec les clés `sk_test_...`. **Encaisser en live exige un abonnement SahelPay payé et en cours** (`403 PAID_SUBSCRIPTION_REQUIRED` sinon), un KYC approuvé et un accès production ouvert par SahelPay.
- **Plafond mensuel live** selon le forfait : 200 000 FCFA pour Starter et Pro (`403 PLAN_MONTHLY_VOLUME_EXCEEDED`).
- `X-Idempotency-Key` **obligatoire** sur `POST /v1/payments`.
- **Retraits** : demandes traitées manuellement par SahelPay (`POST /v1/withdrawals`, minimum 50 000 FCFA). **Payouts automatiques indisponibles.**
- **Remboursements en ligne désactivés** (`POST /v1/refunds` → `503`) : passer par le support.
- **Splits retirés** de l'offre. **OPR** limité à la sandbox.
- Nouveautés : paiement sécurisé à la livraison (`/v1/secure-orders`, pilote sur activation), Programme Partenaires SPAY (SahelPay vendeur de référence, `items[]` sur les paiements).

Voir [l'historique des changements](https://docs.sahelpay.ml/resources/changelog).

## Compatibilité (features par SDK)

| Feature | API | JS/TS | PHP | Python |
| --- | --- | --- | --- | --- |
| Paiements (create / status / search / details / reconcile) | ✅ | ✅ | ✅ | ✅ |
| Polling (attendre un statut final) | ✅ | ✅ | ❌ | ✅ |
| Option `mock` (simulateur) / `sandbox` (sandbox Orange) | ✅ | ✅ | ✅ | ✅ |
| `items[]` Partenaires SPAY | ✅ | ✅ | via tableau brut | ❌ |
| Payment Links (create / list / retrieve / activate / deactivate) | ✅ | ✅ | ✅ | ✅ |
| QR code payment link (`/v1/payment-links/:slug/qr`) | ✅ | ✅ | ✅ | ❌ |
| Webhook signature verify / construct | ✅ | ✅ | ✅ | ✅ |
| Retraits : solde / liste / stats / annulation | ✅ | ✅ | ❌ | ✅ |
| Retraits : création | ✅ | ⚠️ payload obsolète | ❌ | ⚠️ payload obsolète |
| Paiement sécurisé à la livraison | ✅ (pilote) | ❌ | ❌ | ❌ |
| Customer Portal | ✅ | ✅ | ✅ | ✅ |
| Payouts | ❌ indisponible | (helpers présents) | (helpers présents) | (helpers présents) |
| Remboursements | ❌ `503` | (helpers présents) | (helpers présents) | (helpers présents) |
| Plans / abonnements / clients | ✅ sous `/v1/billing/*` | ⚠️ anciennes routes | ⚠️ anciennes routes | ⚠️ anciennes routes |

> ⚠️ : le helper existe mais appelle une route ou un payload que l'API n'accepte plus. Utilisez l'appel HTTP documenté en attendant la correction du SDK.

## Concepts communs

### Environnements & base URL

- **API** : `https://api.sahelpay.ml`, en sandbox comme en production. La clé (`sk_test_...` / `sk_live_...`) détermine le mode.
- **Dashboard** : [app.sahelpay.ml](https://app.sahelpay.ml/dashboard).
- **Simulateur SahelPay** (aucun appel opérateur) : option SDK `mock: true` ou `metadata.sahelpay_mock: true`. Le statut final dépend du montant (4000 réussi, 4001 échoué, 4002 en attente, 4003 erreur opérateur).
- **Sandbox Orange** : option SDK `sandbox: true` ou `metadata.sandbox: true`.
- Ces deux métadonnées sont refusées avec une clé live.

### Authentification

```http
Authorization: Bearer sk_live_...
# ou
Authorization: Bearer sk_test_...
```

> Important : **ne mettez jamais `sk_...` dans un frontend** (React, mobile, navigateur). Utilisez toujours un backend.

### Idempotency (obligatoire)

```http
X-Idempotency-Key: <une_clé_unique_par_commande>
```

Obligatoire sur `POST /v1/payments` et `POST /v1/withdrawals`. Rejouer la même clé renvoie la même ressource ; la même clé avec une demande différente est refusée (`409`). Sur `payments.create()` / `initiate()`, les trois SDKs génèrent une clé aléatoire si vous n'en fournissez pas ; passez une `idempotency_key` stable (liée à la commande) pour que les retries ne créent pas de doublon.

### Provider

- `ORANGE_MONEY` (alias `ORANGE`, `MOBILE_MONEY`) : seul moyen de paiement.
- Sur la page Orange, le client voit le libellé `SPAY-<nom du marchand>`.

### Retour vers le marchand

Après un paiement **confirmé**, la page de paiement SahelPay redirige automatiquement le client vers votre `return_url` (HTTPS, hors domaines SahelPay). Aucun paramètre n'est ajouté : incluez votre référence de commande dans l'URL.

### Webhooks (signature)

- **Header** : `X-SahelPay-Signature: t=<timestamp>,v1=<signature>`
- **Algo** : HMAC-SHA256, digest `hex`
- **Message signé** : `"<timestamp>.<corps brut>"`

```text
v1 = hex(hmac_sha256(secret=WHSEC, message=t + "." + raw_body))
```

Événements émis :

- `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated`
- `secure_order.paid`, `secure_order.released`, `secure_order.refunded`, `secure_order.disputed`, `secure_order.cancelled`
- `invoice.created`, `subscription.payment_due`, `invoice.paid`, `subscription.renewed`
- `webhook.test`

Aucun `payment.cancelled`, `payout.*` ni `refund.*` n'est émis.

### Bonnes pratiques sécurité

- **Secret keys** : seulement côté serveur.
- **Webhook secret** : dans un secret manager / variables d'environnement.
- **Logs** : ne loggez jamais de secrets, tokens ou payloads sensibles.
- **HTTPS obligatoire** sur votre endpoint webhook.

## Installation depuis ce repo

### JavaScript / TypeScript

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/javascript
npm install
npm run build
```

Puis dans votre projet Node/Next/Nest :

```bash
npm install /chemin/vers/sahelpay-sdks/javascript
```

### PHP / Laravel

```json
{
  "repositories": [{ "type": "path", "url": "../sahelpay-sdks/php" }]
}
```

```bash
composer require sahelpay/sahelpay-php:"*"
```

### Python

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/python
pip install -e .
```

## Quickstarts

### JS/TS

```ts
import SahelPay, { SahelPayError } from "@sahelpay/sdk";

const sahelpay = new SahelPay({ secretKey: process.env.SAHELPAY_SECRET_KEY! });

try {
  const payment = await sahelpay.payments.create({
    amount: 5000,
    currency: "XOF",
    payment_method: "ORANGE_MONEY",
    customer_phone: "+22370000000",
    description: "Commande #123",
    client_reference: "order-123",
    return_url: "https://votre-site.com/merci?order=order-123",
    idempotency_key: "order-123",
  });

  // Rediriger le client vers payment.redirect_url
} catch (e) {
  if (e instanceof SahelPayError) console.error(e.code, e.message);
  throw e;
}
```

### PHP

```php
<?php

use SahelPay\SahelPay;

$sahelpay = new SahelPay(getenv('SAHELPAY_SECRET_KEY'));

$payment = $sahelpay->payments->initiate([
  'amount' => 5000,
  'provider' => 'ORANGE_MONEY',
  'customer_phone' => '+22370123456',
  'description' => 'Commande #123',
  'client_reference' => 'order-123',
  'return_url' => 'https://votre-site.com/merci?order=order-123',
  'idempotency_key' => 'order-123',
]);

header('Location: ' . $payment->redirect_url);
```

### Python

```python
import sahelpay

client = sahelpay.Client(secret_key="sk_test_xxx")

payment = client.payments.create(
    amount=5000,
    provider="ORANGE_MONEY",
    customer_phone="+22370000000",
    description="Commande #123",
    client_reference="order-123",
    return_url="https://votre-site.com/merci?order=order-123",
    idempotency_key="order-123",
)

print(payment.redirect_url)
```

## Exemples

- `examples/nextjs-ecommerce/checkout.tsx`
- `examples/django-booking/views.py`
- `templates/nextjs-merchant/`
- `javascript/examples/test-local.ts`
- `php/examples/test-local.php`
- `python/examples/test_local.py`

## Validation de parité contractuelle (smoke)

Avant release, voir `RELEASE_CHECKLIST.md`. Smoke set minimal :

- JavaScript : `cd javascript && npm test && npm run build` (vitest)
- Python : `cd python && SAHELPAY_SECRET_KEY=sk_test_xxx python test_sdk.py`
- PHP : `cd php && ./vendor/bin/phpunit tests/Unit/WebhookTest.php`

## Publier (plus tard)

- **npm (JS)** : voir `javascript/PUBLISHING.md`
- **Composer/Packagist (PHP)** : à ajouter
- **PyPI (Python)** : à ajouter

## FAQ / Troubleshooting

### `401 MISSING_API_KEY` / `INVALID_API_KEY` / `INVALID_KEY_TYPE`

Envoyez exactement `Authorization: Bearer sk_test_...` (jamais une clé `pk_...`).

### `401 PRODUCTION_KEY_DISABLED` ou `403 PAID_SUBSCRIPTION_REQUIRED`

La clé live n'est acceptée qu'avec un KYC approuvé, un accès production ouvert par SahelPay et un abonnement payé en cours. Sans abonnement, le compte fonctionne en sandbox. Voir [Passer en production](https://docs.sahelpay.ml/guides/going-live).

### `400 IDEMPOTENCY_KEY_REQUIRED`

Ajoutez `X-Idempotency-Key` (option `idempotency_key` des SDKs).

### `403 PLAN_MONTHLY_VOLUME_EXCEEDED`

Le plafond mensuel live de votre forfait est atteint (200 000 FCFA pour Starter et Pro).

### « Invalid webhook signature »

La signature est calculée sur le **corps brut** :

- **Express** : `express.raw({ type: "application/json" })` sur la route webhook.
- **Laravel** : `$request->getContent()` (pas `$request->all()`).
- **Flask** : `request.get_data(as_text=True)`.

### « Paiement reste PENDING »

- Vérifier que le client a validé sur la page Orange Money.
- Vérifier que le webhook arrive (HTTPS, route accessible).
- En secours : `GET /v1/payments/{id}/status` ou `POST /v1/payments/{id}/reconcile`.

### « Timeout / network error »

Réessayer avec la **même** `X-Idempotency-Key` : vous obtenez le même paiement, jamais un doublon.
