# SahelPay SDK for JavaScript/TypeScript

SDK officiel pour intégrer les paiements SahelPay (Orange Money, Mali) dans vos applications JavaScript/TypeScript côté serveur. Documentation : https://docs.sahelpay.ml

## Installation

```bash
npm install @sahelpay/sdk
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
- **Production** (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay. Inscription gratuite et sans abonnement : SahelPay facture une commission par transaction réussie. Pas de plafond de forfait : seuls les plafonds KYC s'appliquent.

## Tests

Deux options, réservées aux clés de test :

- `mock: true` → simulateur SahelPay, aucun appel opérateur. Statut final selon le montant : `4000` réussi, `4001` échoué, `4002` en attente, `4003` erreur opérateur.
- `sandbox: true` → environnement de test d'Orange.

```typescript
const payment = await sahelpay.payments.create({
  amount: 4000,
  payment_method: "ORANGE_MONEY",
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
  name: "Formation React",
  fixed_amount: 25000, // prix imposé (amount_mode FIXED)
  success_redirect_url: "https://votre-site.com/merci",
});

console.log(link.url); // https://pay.sahelpay.africa/<slug>

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

### Billing 1.2.0 — abonnements clients / customer subscriptions

```typescript
const plan = await sahelpay.plans.create({ name: 'Premium TEST', amount: 4000, interval: 'MONTHLY' });
const checkout = await sahelpay.subscriptions.createWithPayment({
  plan_id: plan.id,
  customer_external_ref: 'test_user_PLACEHOLDER',
  external_ref: 'test_checkout_PLACEHOLDER',
  idempotency_key: 'test_checkout_PLACEHOLDER',
});
const current = await sahelpay.subscriptions.retrieve(checkout.subscription.id);
const { invoices, pagination } = await sahelpay.invoices.list({ subscription_id: current.id, limit: 20, offset: 0 });
const { customers } = await sahelpay.customers.list({ search: 'test_user_PLACEHOLDER', page: 1, limit: 20 });
await sahelpay.subscriptions.cancel(current.id);
```

`customer_phone` est facultatif si une autre identité est fournie (`customer_id`,
`customer_external_ref`, `customer_email`). Quatre fréquences : WEEKLY, MONTHLY,
QUARTERLY, YEARLY. `trial_end` explicite crée un essai : `invoice` et `payment_link`
sont alors **null**. `current_period_start/end`, `trial_end`, `updated_at` et
`livemode` sont disponibles via GET canonique ; les anciennes périodes peuvent être null.
**ACTIVE ≠ paid** : vérifiez la facture `PAID`, son solde nul et la période avant
les droits payés. Un webhook est un signal de relecture, à dédupliquer sur `event.id`.

`idempotency_key` devient l'en-tête `X-Idempotency-Key`. Sur la base ec4548f, ce header
seul ne garantit pas tous les rejeux Billing : utilisez aussi `external_ref` stable
avec `customer_external_ref` pour le checkout. Import d'une période courante :
`subscriptions.import({plan_id, external_ref, customer_external_ref, current_period_start, current_period_end})`.
Les méthodes factures sont `create`, `retrieve`, `list`, `open`, `void`, `generatePaymentLink`.

Phone is optional with another customer identity. Explicit trials return null invoice
and payment link. ACTIVE alone never proves payment. Verify signed raw-body events,
deduplicate event IDs, then retrieve canonical subscription/invoice state. Billing
uses manual Orange Money renewal, no automatic debit. See the bilingual guide and
lifecycle diagram: https://docs.sahelpay.ml/guides/subscriptions

### Customer Portal

```typescript
const session = await sahelpay.portal.createSession({
  customer_phone: process.env.SAHELPAY_TEST_CUSTOMER_PHONE!, // Téléphone de test autorisé par le propriétaire
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
        // Accès production non en cours (aucun abonnement n'est requis aujourd'hui)
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

La version Billing 1.2.0 est disponible dans les sources taguées `javascript-v1.2.0`.
Avant d'installer `@sahelpay/sdk@^1.2.0`, vérifiez `npm view @sahelpay/sdk version`.
Si npm indique encore 1.1.0, clonez ce tag, exécutez `npm ci` puis `npm run build`
dans `javascript` et installez ce dossier local. La publication npm dépend des accès
au registre ; une version source taguée n'implique pas sa disponibilité sur npm.
