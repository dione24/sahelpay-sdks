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
5. **Client paie** → Via Orange Money, Wave, etc.
6. **Provider confirme** → SahelPay reçoit la confirmation
7. **Webhook envoyé** → `payment.success` vers l'app ⚠️ **SOURCE DE VÉRITÉ**
8. **Client redirigé** → Vers `return_url` de l'app
9. **Page return** → Vérifie le statut (UX uniquement)

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
  // Générer une clé d'idempotence unique
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
      client_reference: orderId,
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
  "metadata": {
    "app_order_id": "order_abc123",
    "app_user_id": "user_xyz"
  }
}
```

### 3. Réponse SahelPay

```json
{
  "success": true,
  "data": {
    "id": "txn_abc123def456",
    "status": "PENDING",
    "amount": 5000,
    "currency": "XOF",
    "redirect_url": "https://pay.sahelpay.ml/checkout/txn_abc123def456",
    "expires_at": "2025-12-18T17:00:00.000Z",
    "created_at": "2025-12-18T16:45:00.000Z"
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
  "event": "payment.success",
  "version": "v1",
  "timestamp": "2025-12-18T16:50:00.000Z",
  "data": {
    "id": "txn_abc123def456",
    "reference_id": "txn_abc123def456",
    "amount": 5000,
    "currency": "XOF",
    "status": "SUCCESS",
    "provider": "ORANGE_MONEY",
    "provider_ref": "OM123456789",
    "customer_phone": "+22370123456",
    "metadata": {
      "app_order_id": "order_abc123",
      "app_user_id": "user_xyz"
    },
    "created_at": "2025-12-18T16:45:00.000Z",
    "updated_at": "2025-12-18T16:50:00.000Z"
  }
}
```

### Headers webhook

| Header                 | Description                |
| ---------------------- | -------------------------- |
| `X-SahelPay-Signature` | `t=timestamp,v1=signature` |
| `X-SahelPay-Timestamp` | Timestamp UNIX (secondes)  |
| `X-SahelPay-Event-ID`  | ID unique de l'événement   |

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

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-sahelpay-signature") || "";

  // 1. Vérifier la signature
  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, data } = JSON.parse(rawBody);
  const orderId = data.metadata?.app_order_id;

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

if (existing && ["success", "failed", "cancelled"].includes(existing.status)) {
  console.log(`Payment ${data.id} already processed`);
  return Response.json({ received: true, already_processed: true });
}
```

---

## Erreurs courantes

| Code                   | Description                      | Action                    |
| ---------------------- | -------------------------------- | ------------------------- |
| `INVALID_AMOUNT`       | Montant invalide (< 100 ou > 5M) | Vérifier le montant       |
| `INVALID_PHONE`        | Numéro de téléphone invalide     | Format: +223XXXXXXXX      |
| `ALREADY_PAID`         | Commande déjà payée              | Vérifier l'idempotence    |
| `PAYMENT_EXPIRED`      | Paiement expiré                  | Créer un nouveau paiement |
| `INSUFFICIENT_BALANCE` | Solde client insuffisant         | Informer le client        |

---

## Ce que l'app NE DOIT PAS faire

### 🚫 INTERDICTIONS ABSOLUES

1. **NE PAS appeler Orange / CinetPay / Wave directement**

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
- [ ] Tests en sandbox avant production

---

## Support

- Documentation API: https://docs.sahelpay.ml
- Swagger: https://api.sahelpay.ml/docs
- Email: support@sahelpay.ml
