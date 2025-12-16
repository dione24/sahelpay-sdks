# SahelPay SDKs (monorepo)

Ce dépôt regroupe les SDKs officiels SahelPay pour intégrer l’API SahelPay (paiements Mobile Money, liens de paiement, payouts/retraits, webhooks) dans vos applications.

> Statut: **en cours de packaging**. Les SDKs ne sont pas encore publiés sur NPM / Packagist / PyPI.
> En attendant, vous pouvez **cloner ce repo** et installer chaque SDK en local.

## Table des matières

- [Packages](#packages)
- [Concepts communs](#concepts-communs)
  - [Environnements & base URL](#environnements--base-url)
  - [Authentification](#authentification)
  - [Idempotency (recommandé)](#idempotency-recommandé)
  - [Providers](#providers)
  - [Webhooks (signature)](#webhooks-signature)
  - [Bonnes pratiques sécurité](#bonnes-pratiques-sécurité)
- [Installation depuis ce repo (dev / staging)](#installation-depuis-ce-repo-dev--staging)
  - [JavaScript / TypeScript](#javascript--typescript)
  - [PHP / Laravel](#php--laravel)
  - [Python](#python)
- [Quickstarts](#quickstarts)
  - [JS/TS](#jsts)
  - [PHP](#php)
  - [Python](#python-1)
- [Fonctionnalités couvertes](#fonctionnalités-couvertes)
- [Exemples](#exemples)
- [Publier (plus tard)](#publier-plus-tard)

## Packages

- **JavaScript/TypeScript**: `./javascript` (package cible: `@sahelpay/sdk`)
- **PHP/Laravel**: `./php` (package cible: `sahelpay/sahelpay-php`)
- **Python**: `./python` (package cible: `sahelpay`)
- **Exemples multi-langages**: `./examples`

## Concepts communs

### Environnements & base URL

- **Production**: `https://api.sahelpay.ml`
- **Sandbox / test**: selon votre infra (souvent `https://sandbox.sahelpay.ml`), ou indiquez un `baseUrl` explicite.

Dans tous les SDKs, vous pouvez:

- soit choisir un `environment` (`production` / `sandbox`)
- soit forcer un `baseUrl`.

### Authentification

- L’API est protégée par **clé secrète** (server-side):

```http
Authorization: Bearer sk_live_...
# ou
Authorization: Bearer sk_test_...
```

> Important: **ne mettez jamais `sk_...` dans un frontend** (React, mobile, navigateur). Utilisez toujours un backend.

### Idempotency (recommandé)

Sur les endpoints de création (ex: paiement), envoyez:

```http
x-idempotency-key: <une_clé_unique_par_action>
```

But: éviter les doubles paiements en cas de retry réseau.

### Providers

Codes les plus courants:

- `ORANGE_MONEY`
- `WAVE`
- `MOOV`

### Webhooks (signature)

SahelPay signe les webhooks envoyés à votre serveur avec:

- **Header**: `X-SahelPay-Signature`
- **Algo**: HMAC-SHA256
- **Digest**: `hex`
- **Payload**: le **corps brut** JSON (raw body), tel que reçu.

En pseudo-code:

```text
signature = hex(hmac_sha256(secret=WHSEC, message=raw_body))
```

Événements typiques:

- `payment.success`
- `payment.failed`
- `payment.cancelled`
- `payout.completed`
- `payout.failed`

### Bonnes pratiques sécurité

- **Secret keys**: seulement côté serveur.
- **Webhook secret**: gardez-le dans un secret manager / variables d’environnement.
- **Logs**: ne loggez jamais des secrets, tokens, ou payloads sensibles.
- **HTTPS obligatoire** sur votre endpoint webhook.

## Installation depuis ce repo (dev / staging)

### JavaScript / TypeScript

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/javascript
npm install
npm run build
```

Ensuite, dans votre projet Node/Next/Nest:

```bash
npm install /chemin/vers/sahelpay-sdks/javascript
```

### PHP / Laravel

Option dev (path repository):

1. Clonez ce repo à côté de votre projet
2. Ajoutez ceci dans le `composer.json` de votre app:

```json
{
  "repositories": [{ "type": "path", "url": "../sahelpay-sdks/php" }]
}
```

3. Puis:

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

const sahelpay = new SahelPay({
  secretKey: process.env.SAHELPAY_SECRET_KEY!,
  environment: "production",
  // baseUrl: "https://api.sahelpay.ml",
});

try {
  const payment = await sahelpay.payments.create({
    amount: 5000,
    currency: "XOF",
    provider: "ORANGE_MONEY",
    customer_phone: "+22370000000",
    description: "Commande #123",
  });

  const confirmed = await sahelpay.payments.poll(payment.reference_id);
  console.log("Status final:", confirmed.status);
} catch (e) {
  if (e instanceof SahelPayError) {
    console.error(e.code, e.message);
  }
  throw e;
}
```

### PHP

```php
<?php

use SahelPay\SahelPay;

$sahelpay = new SahelPay(
  getenv('SAHELPAY_SECRET_KEY'),
  getenv('SAHELPAY_PUBLIC_KEY')
);

$payment = $sahelpay->payments->initiate([
  'amount' => 5000,
  'currency' => 'XOF',
  'provider' => 'ORANGE_MONEY',
  'customer_phone' => '+22370123456',
  'description' => 'Commande #123',
]);

echo $payment->reference_id;
```

### Python

```python
import sahelpay

client = sahelpay.Client(
    secret_key="sk_live_xxx",
    environment="production",
)

payment = client.payments.create(
    amount=5000,
    currency="XOF",
    provider="ORANGE_MONEY",
    customer_phone="+22370000000",
    description="Commande #123",
)

print(payment.reference_id)
```

## Fonctionnalités couvertes

Selon le SDK, vous trouverez notamment:

- **Paiements**: création, statut, récupération, listing, polling, providers, recommandation
  - API core: `POST /v1/payments`, `GET /v1/payments/:ref/status`, `GET /v1/payments/providers`, `GET /v1/payments/recommend`
- **Payment Links**: création, listing, récupération, désactivation, QR
  - API core: `GET /v1/payment-links/:slug/qr` etc.
- **Payouts**: création, récupération, listing, annulation, stats, polling
- **Withdrawals** (si supporté côté SDK): solde, création, listing, stats, annulation

Pour le détail complet, voir:

- `javascript/README.md`
- `php/README.md`
- `python/README.md`

## Exemples

- `examples/nextjs-ecommerce/checkout.tsx`
- `examples/django-booking/views.py`
- `javascript/examples/test-local.ts`
- `php/examples/test-local.php`
- `python/examples/test_local.py`

## Publier (plus tard)

- **NPM (JS)**: voir `javascript/PUBLISHING.md`
- **Composer/Packagist (PHP)**: à ajouter (VCS/Packagist)
- **PyPI (Python)**: à ajouter
