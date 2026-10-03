# Standard d'Intégration SahelPay

Ce document définit le **contrat d'intégration officiel** pour toutes les applications marchandes utilisant SahelPay comme solution de paiement.

**Applications concernées:** Sani, EduFlow, SewePay, et toute app tierce.

---

## 📋 Table des matières

- [Principes fondamentaux](#principes-fondamentaux)
- [Flow de paiement](#flow-de-paiement)
- [Implémentation](#implémentation)
- [Webhook (Source de vérité)](#webhook-source-de-vérité)
- [Règles d'idempotence](#règles-didempotence)
- [Erreurs courantes](#erreurs-courantes)
- [Ce que l'app NE DOIT PAS faire](#ce-que-lapp-ne-doit-pas-faire)

---

## Principes fondamentaux

### ⚠️ RÈGLES NON NÉGOCIABLES

1. **L'app marchande est un MERCHANT SahelPay, pas un PSP**
2. **L'app NE calcule AUCUN frais** - SahelPay gère tout
3. **L'app NE gère AUCUN solde** - Pas de wallet interne
4. **Toute décision financière vient de SahelPay Core**
5. **Le webhook SahelPay est la SEULE source de vérité paiement**

### Clés API

| Variable                  | Description                            | Où l'utiliser          |
| ------------------------- | -------------------------------------- | ---------------------- |
| `SAHELPAY_SECRET_KEY`     | Clé secrète (sk_live_xxx)              | **Serveur uniquement** |
| `SAHELPAY_WEBHOOK_SECRET` | Secret pour vérifier les webhooks      | **Serveur uniquement** |
| `SAHELPAY_API_URL`        | URL de l'API (https://api.sahelpay.ml) | Serveur                |

---

## Flow de paiement

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  App Server │     │  SahelPay   │     │  Provider   │
│  (Browser)  │     │  (Backend)  │     │    Core     │     │ (Orange..)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
   1.  │ Click "Payer"     │                   │                   │
       │──────────────────>│                   │                   │
       │                   │                   │                   │
   2.  │                   │ POST /v1/payments │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
   3.  │                   │ { redirect_url }  │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
   4.  │ Redirect to       │                   │                   │
       │ SahelPay checkout │                   │                   │
       │<──────────────────│                   │                   │
       │                   │                   │                   │
   5.  │ Client paie       │                   │                   │
       │───────────────────────────────────────────────────────────>│
       │                   │                   │                   │
   6.  │                   │                   │   Confirmation    │
       │                   │                   │<──────────────────│
       │                   │                   │                   │
   7.  │                   │  WEBHOOK          │                   │
       │                   │  payment.success  │                   │
       │                   │<──────────────────│                   │
       │                   │                   │                   │
   8.  │ Redirect to       │                   │                   │
       │ return_url        │                   │                   │
       │<──────────────────────────────────────│                   │
       │                   │                   │                   │
   9.  │ Vérifier statut   │                   │                   │
       │──────────────────>│ GET /status       │                   │
       │                   │──────────────────>│                   │
       │                   │                   │                   │
```

### Étapes clés

1. **Client clique "Payer"** → Appel API interne de l'app
2. **Backend crée le paiement** → `POST /v1/payments` vers SahelPay
3. **SahelPay retourne** → `redirect_url` vers le checkout
4. **Client redirigé** → Page de paiement SahelPay
5. **Client paie** → Via Orange Money (seul moyen de paiement ; libellé `SPAY-<nom du marchand>`)
6. **Orange confirme** → SahelPay vérifie la confirmation
7. **Webhook envoyé** → `payment.success` vers l'app ⚠️ **SOURCE DE VÉRITÉ**
8. **Client redirigé** → Automatiquement vers `return_url` après un paiement **confirmé** (HTTPS, hors domaines SahelPay, sans paramètre ajouté)
9. **Page return** → Vérifie le statut côté serveur à partir de `order_id` (UX uniquement)

### Prérequis production

- Sandbox (`sk_test_...`) gratuite, sans abonnement.
- Live (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay et **abonnement SahelPay payé en cours** (`403 PAID_SUBSCRIPTION_REQUIRED` sinon).
- Plafond mensuel live selon le forfait : 200 000 FCFA pour Starter et Pro (`403 PLAN_MONTHLY_VOLUME_EXCEEDED`).

---

## Implémentation

### 1. Créer un paiement (Backend)

```typescript
// POST /api/payments/create (votre API route)

const SAHELPAY_API_URL = process.env.SAHELPAY_API_URL;
const SAHELPAY_SECRET_KEY = process.env.SAHELPAY_SECRET_KEY;

async function createPayment(
  orderId: string,
  amount: number,
  customer: Customer
) {
  // Clé d'idempotence stable par commande (header obligatoire)
  const idempotencyKey = `${APP_NAME}-order-${orderId}`;

  const response = await fetch(`${SAHELPAY_API_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SAHELPAY_SECRET_KEY}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      amount: amount,
      currency: "XOF",
      payment_method: "MOBILE_MONEY",
      country: "ML",
      customer: {
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
      },
      return_url: `${APP_URL}/checkout/return?order_id=${orderId}`,
      client_reference: orderId, // renvoyé dans chaque webhook
      hosted_checkout: true,
      metadata: {
        app_order_id: orderId,
        app_user_id: customer.id,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Erreur SahelPay");
  }

  // Enregistrer le paiement en local (status: pending)
  await db.payments.create({
    order_id: orderId,
    transaction_id: data.data.id,
    amount: amount,
    status: "pending",
  });

  return {
    payment_id: data.data.id,
    redirect_url: data.data.redirect_url,
  };
}
```

### 2. Payload `POST /v1/payments`

```json
{
  "amount": 5000,
  "currency": "XOF",
  "payment_method": "MOBILE_MONEY",
  "country": "ML",
  "customer": {
    "phone": "+22370123456",
    "name": "Amadou Diallo",
    "email": "amadou@example.com"
  },
  "return_url": "https://app.example.com/checkout/return?order_id=xxx",
  "client_reference": "order_abc123",
  "hosted_checkout": true,
  "metadata": {
    "app_order_id": "order_abc123",
    "app_user_id": "user_xyz"
  }
}
```

> Seul Orange Money est accepté (`payment_method`: `MOBILE_MONEY`, `ORANGE_MONEY` ou `ORANGE`). Les `metadata` personnalisées sont conservées sur le paiement mais **ne sont pas renvoyées dans les webhooks** : utilisez `client_reference`.

### 3. Réponse SahelPay

```json
{
  "success": true,
  "data": {
    "id": "8d6f1c2e-4b1a-4c55-9a0e-3f2b7c1d9e10",
    "status": "INITIATED",
    "amount": 5000,
    "amount_charged": 5000,
    "fee_total": 50,
    "currency": "XOF",
    "redirect_url": "https://app.sahelpay.ml/checkout/8d6f1c2e-4b1a-4c55-9a0e-3f2b7c1d9e10",
    "checkout_url": "https://app.sahelpay.ml/checkout/8d6f1c2e-4b1a-4c55-9a0e-3f2b7c1d9e10",
    "created_at": "2026-10-03T10:00:00.000Z"
  }
}
```

---

## Webhook (Source de vérité)

### ⚠️ RÈGLE ABSOLUE

> **Le webhook est la SEULE source de vérité pour le statut d'un paiement.**
>
> Ne JAMAIS marquer une commande comme "payée" basé sur le `return_url`.
> Le `return_url` sert uniquement à l'UX (afficher un message).

### Payload webhook `payment.success`

```json
{
  "id": "evt_1759480000000_9f2c4e1a7b3d5c60",
  "event": "payment.success",
  "version": "v1",
  "timestamp": "2026-10-03T10:05:00.000Z",
  "data": {
    "id": "8d6f1c2e-4b1a-4c55-9a0e-3f2b7c1d9e10",
    "reference_id": "order_abc123",
    "client_reference": "order_abc123",
    "amount": 5000,
    "amount_charged": 5000,
    "amount_merchant_net": 4950,
    "fee_total": 50,
    "currency": "XOF",
    "status": "SUCCESS",
    "provider": "orange_webpay_ml",
    "customer_phone": "+22370123456",
    "metadata": {
      "description": "Commande #123"
    },
    "dashboard_url": "https://app.sahelpay.ml/dashboard/transactions/8d6f1c2e-4b1a-4c55-9a0e-3f2b7c1d9e10",
    "created_at": "2026-10-03T10:00:00.000Z",
    "updated_at": "2026-10-03T10:05:00.000Z"
  }
}
```

Événements de paiement émis : `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated` (plus `webhook.test`). Aucun `payment.cancelled`.

### Headers webhook

| Header                           | Description                |
| -------------------------------- | -------------------------- |
| `X-SahelPay-Signature`           | `t=timestamp,v1=signature` |
| `X-SahelPay-Timestamp`           | Timestamp UNIX (secondes)  |
| `X-SahelPay-Event-ID`            | ID unique de l'événement   |
| `X-SahelPay-Signature-Algorithm` | `HMAC-SHA256`              |

### Implémentation webhook

```typescript
// POST /api/webhooks/sahelpay

import crypto from "crypto";

function verifySignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  const parts: Record<string, string> = {};
  signatureHeader.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    if (key && value) parts[key] = value;
  });

  const timestamp = parts["t"];
  const signature = parts["v1"];

  if (!timestamp || !signature) return false;

  // Protection replay
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > toleranceSeconds) return false;

  // Vérifier signature
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return (
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-sahelpay-signature") || "";

  // 1. Vérifier la signature
  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, data } = JSON.parse(rawBody);
  const orderId = data.client_reference; // les metadata personnalisées ne sont pas renvoyées

  // 2. Idempotence: vérifier si déjà traité
  const existing = await db.payments.findByTransactionId(data.id);
  if (existing?.status === "success") {
    return Response.json({ received: true, already_processed: true });
  }

  // 3. Traiter selon l'événement
  switch (event) {
    case "payment.success":
      await db.payments.update(data.id, { status: "success" });
      await db.orders.update(orderId, { status: "paid" });
      // Décrémenter stock, envoyer email, etc.
      break;

    case "payment.failed":
      await db.payments.update(data.id, { status: "failed" });
      break;

    case "payment.expired":
      await db.payments.update(data.id, { status: "expired" });
      break;
  }

  return Response.json({ received: true });
}
```

---

## Règles d'idempotence

### Côté création de paiement

```typescript
// Toujours utiliser une clé d'idempotence basée sur l'order_id
const idempotencyKey = `${APP_NAME}-order-${orderId}`;

// Headers
headers: {
  'X-Idempotency-Key': idempotencyKey,
}
```

### Côté webhook

```typescript
// Vérifier si le paiement est déjà dans un état terminal
const existing = await db.payments.findByTransactionId(data.id);

if (existing && ["success", "failed", "expired"].includes(existing.status)) {
  console.log(`Payment ${data.id} already processed`);
  return Response.json({ received: true, already_processed: true });
}
```

---

## Erreurs courantes

| Code (HTTP)                          | Description                                               | Action                                  |
| ------------------------------------ | --------------------------------------------------------- | --------------------------------------- |
| `IDEMPOTENCY_KEY_REQUIRED` (400)     | Header `X-Idempotency-Key` absent                         | Toujours l'envoyer                      |
| `BAD_REQUEST` (400)                  | Montant hors 100–5 000 000, téléphone non international, provider autre qu'Orange | Corriger la requête |
| `PAID_SUBSCRIPTION_REQUIRED` (403)   | Pas d'abonnement SahelPay payé pour le live               | Payer l'abonnement (dashboard)          |
| `PLAN_MONTHLY_VOLUME_EXCEEDED` (403) | Plafond mensuel du forfait atteint                        | Attendre le mois suivant / changer d'offre |
| `KYC_PAYMENT_LIMIT_EXCEEDED` (403)   | Plafond KYC dépassé                                       | Compléter le KYC                        |
| — (409)                              | Même clé d'idempotence, demande différente                | Vérifier la commande avant de réessayer |

Un paiement expiré (`payment.expired`) ne se relance pas : créez un nouveau paiement avec une nouvelle clé d'idempotence.

---

## Ce que l'app NE DOIT PAS faire

### 🚫 INTERDICTIONS ABSOLUES

1. **NE PAS appeler Orange Money directement**

   - Tout passe par SahelPay

2. **NE PAS dupliquer la logique de paiement**

   - Pas de calcul de frais
   - Pas de gestion de providers

3. **NE PAS créer de "wallet" ou stocker de solde**

   - SahelPay gère les fonds

4. **NE PAS marquer "PAID" sans webhook SUCCESS**

   - Le return_url est pour l'UX uniquement

5. **NE PAS exposer la clé secrète côté client**

   - Toujours passer par le backend

6. **NE PAS ignorer la vérification de signature**
   - Toujours vérifier les webhooks

### ✅ CE QUE L'APP DOIT FAIRE

1. **Créer le paiement via son backend** → SahelPay
2. **Rediriger le client** vers `redirect_url`
3. **Implémenter le webhook** et vérifier la signature
4. **Mettre à jour la commande** uniquement sur webhook SUCCESS
5. **Afficher un statut UX** sur la page return (polling)
6. **Utiliser des clés d'idempotence** pour éviter les doublons

---

## Checklist d'intégration

- [ ] Variables d'environnement configurées
- [ ] API route `/api/payments/create` implémentée
- [ ] Webhook `/api/webhooks/sahelpay` implémenté
- [ ] Vérification de signature webhook
- [ ] Page return avec vérification de statut
- [ ] Idempotence sur création de paiement
- [ ] Idempotence sur traitement webhook
- [ ] Bouton "Payer avec SahelPay" dans l'UI
- [ ] Tests en sandbox avant production (simulateur : `metadata.sahelpay_mock: true`)
- [ ] KYC approuvé, accès production et abonnement SahelPay payé avant le passage en live

---

## Support

- Documentation API : https://docs.sahelpay.ml
- Dashboard : https://app.sahelpay.ml
- Email : support@sahelpay.africa
