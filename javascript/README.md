# SahelPay SDK for JavaScript/TypeScript

SDK officiel pour intégrer les paiements SahelPay (Orange Money, Mali) dans vos applications JavaScript/TypeScript côté serveur. Documentation : https://docs.sahelpay.ml

## Installation

Le paquet `@sahelpay/sdk` n'est pas encore publié sur npm. Installez-le depuis ce dépôt :

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/javascript
npm install
npm run build
# puis dans votre projet
npm install /chemin/vers/sahelpay-sdks/javascript
```

Le SDK utilise `fetch` global (Node.js 18+).

## Démarrage rapide

```typescript
import SahelPay from "@sahelpay/sdk";

const sahelpay = new SahelPay({
  secretKey: process.env.SAHELPAY_SECRET_KEY!, // sk_test_... ou sk_live_...
});

const payment = await sahelpay.payments.create({
  amount: 5000,
  currency: "XOF",
  payment_method: "ORANGE_MONEY", // seul moyen de paiement
  customer_phone: "+22370000000",
  description: "Commande #123",
  client_reference: "order-123",
  return_url: "https://votre-site.com/merci?order=order-123",
  idempotency_key: "order-123",
});

console.log(payment.id);
console.log(payment.redirect_url); // checkout SahelPay (hosted_checkout: true par défaut)
```

Points clés :

- **Orange Money est le seul moyen de paiement** ; tout autre `provider` / `payment_method` est rejeté (`400`).
- `X-Idempotency-Key` est obligatoire côté API. Passez `idempotency_key` (stable, liée à votre commande) ; sinon le SDK en génère une aléatoire à chaque appel, ce qui ne protège pas des doublons lors d'un retry.
- Après un paiement confirmé, le client est renvoyé automatiquement vers `return_url` (HTTPS, hors domaines SahelPay).
- Partenaires SPAY : passez `items: [{ product_id, quantity }]`.

## Sandbox et production

La base URL est `https://api.sahelpay.ml` dans tous les cas ; la clé détermine le mode.

- **Sandbox** (`sk_test_...`) : gratuite, sans abonnement.
- **Production** (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay et **abonnement SahelPay payé en cours** (`403 PAID_SUBSCRIPTION_REQUIRED` sinon). Plafond mensuel live selon le forfait (200 000 FCFA pour Starter et Pro, `403 PLAN_MONTHLY_VOLUME_EXCEEDED`).

## Tests

Deux options, réservées aux clés de test :

- `mock: true` → simulateur SahelPay, aucun appel opérateur. Statut final selon le montant : `4000` réussi, `4001` échoué, `4002` en attente, `4003` erreur opérateur.
- `sandbox: true` → environnement de test d'Orange.

```typescript
const payment = await sahelpay.payments.create({
  amount: 4000,
  payment_method: "ORANGE_MONEY",
  customer_phone: "+22370000000",
  hosted_checkout: false, // la simulation démarre à l'initiation
  mock: true,
});

const { status } = await sahelpay.payments.checkStatus(payment.id);
console.log(status); // SUCCESS

await sahelpay.webhooks.test(); // envoie webhook.test vers l'URL configurée
```

## API Reference

### Paiements

```typescript
const result = await sahelpay.payments.checkStatus(payment.id);
console.log(result.status); // 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED'

const p = await sahelpay.payments.retrieve(payment.id);       // GET /v1/payments/{id}/status
const byOrder = await sahelpay.payments.search("order-123");  // null si introuvable
const details = await sahelpay.payments.details(payment.id);  // frais, écritures
await sahelpay.payments.reconcile(payment.id);                // revérifier auprès d'Orange
const final = await sahelpay.payments.poll(payment.id);       // attendre un statut final
```

> `payments.list()` lit `GET /v1/payments/history`, qui ne contient pas les paiements créés via `POST /v1/payments`.

### Liens de paiement

```typescript
const link = await sahelpay.paymentLinks.create({
  title: "Formation React",
  price: 25000,
  redirect_url: "https://votre-site.com/merci",
});

console.log(link.url); // https://pay.sahelpay.ml/<slug>

const links = await sahelpay.paymentLinks.list();
await sahelpay.paymentLinks.deactivate(link.id);
const { qr_code } = await sahelpay.paymentLinks.qrCode(link.slug);
```

### Retraits

Les retraits de solde vers Orange Money sont des demandes **traitées manuellement** par SahelPay (minimum 50 000 FCFA, frais 1 % minimum 100 FCFA).

```typescript
const balance = await sahelpay.withdrawals.balance();
const { withdrawals } = await sahelpay.withdrawals.list({ page: 1, limit: 20 });
await sahelpay.withdrawals.cancel("withdrawal_id"); // demande encore PENDING
```

> `withdrawals.create()` envoie un payload obsolète : créez les demandes via `POST /v1/withdrawals` (`amount`, `provider: "ORANGE_MONEY"`, `phone_number`, header `X-Idempotency-Key`) ou le dashboard.

### Webhooks

```typescript
import express from "express";

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-sahelpay-signature"] as string;

  try {
    const event = sahelpay.webhooks.constructEvent(
      req.body.toString("utf8"),
      signature,
      process.env.SAHELPAY_WEBHOOK_SECRET!
    );

    switch (event.event) {
      case "payment.success":
        // Mettre à jour la commande (data.client_reference)
        break;
      case "payment.failed":
      case "payment.expired":
        break;
    }

    res.json({ received: true });
  } catch {
    res.status(400).send("Webhook Error");
  }
});
```

Événements émis : `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated`, `secure_order.*`, `invoice.created`, `invoice.paid`, `subscription.payment_due`, `subscription.renewed`, `webhook.test`.

### Customer Portal

```typescript
const session = await sahelpay.portal.createSession({
  customer_phone: "+22370000000",
  return_url: "https://votre-site.com/compte",
});
// Rediriger le client vers session.url
```

## Helpers à éviter pour l'instant

| Helper | Raison |
| --- | --- |
| `payouts.*` | Payouts automatiques indisponibles côté API |
| `refunds.*` | Remboursements en ligne désactivés (`503`), passer par le support |
| `hasCapability()` & co. | Table statique : seul Orange Money, sans payouts automatiques |
| `GatewayEventSource` / `useGatewayStream()` | Retiré de l'export public (flux admin SahelPay) |

## Gestion des erreurs

```typescript
import { SahelPayError } from "@sahelpay/sdk";

try {
  await sahelpay.payments.create({ /* ... */ });
} catch (error) {
  if (error instanceof SahelPayError) {
    console.error(error.code, error.statusCode, error.message);

    switch (error.code) {
      case "PAID_SUBSCRIPTION_REQUIRED":
        // Abonnement SahelPay requis pour le live
        break;
      case "PLAN_MONTHLY_VOLUME_EXCEEDED":
        // Plafond mensuel atteint
        break;
      case "IDEMPOTENCY_KEY_REQUIRED":
        break;
    }
  }
}
```

## TypeScript

```typescript
import SahelPay, {
  Payment,
  PaymentLink,
  CreatePaymentParams,
  SahelPayConfig,
} from "@sahelpay/sdk";
```

## Support

- Documentation : https://docs.sahelpay.ml
- Email : support@sahelpay.africa
- GitHub Issues : https://github.com/dione24/sahelpay-sdks/issues

## License

MIT
