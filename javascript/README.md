# SahelPay SDK for JavaScript/TypeScript

SDK officiel pour intégrer les paiements SahelPay dans vos applications JavaScript/TypeScript.

## Installation

```bash
npm install @sahelpay/sdk
# ou
yarn add @sahelpay/sdk
# ou
pnpm add @sahelpay/sdk
```

> Note: si vous utilisez ce monorepo avant publication NPM, clonez le repo et installez le dossier `javascript/` en local.

```bash
git clone https://github.com/dione24/sahelpay-sdks.git
cd sahelpay-sdks/javascript
npm install
npm run build
```

## Démarrage rapide

```typescript
import SahelPay from "@sahelpay/sdk";

const sahelpay = new SahelPay({
  secretKey: "sk_live_xxx", // Votre clé secrète
  environment: "production", // ou 'sandbox' pour les tests
});

// Créer un paiement
const payment = await sahelpay.payments.create({
  amount: 5000,
  currency: "XOF",
  provider: "ORANGE_MONEY",
  customer_phone: "+22370000000",
  description: "Commande #123",
});

console.log(payment.reference_id); // SP_xxx
console.log(payment.ussd_code); // *144*xxx# (pour Orange Money)
```

## Providers supportés

| Provider     | Code           | Pays                                  |
| ------------ | -------------- | ------------------------------------- |
| Orange Money | `ORANGE_MONEY` | Mali, Sénégal, Côte d'Ivoire, Burkina |
| Wave         | `WAVE`         | Mali, Sénégal, Côte d'Ivoire          |
| Moov Money   | `MOOV`         | Mali, Côte d'Ivoire, Burkina, Niger   |

## API Reference

### Paiements

```typescript
// Créer un paiement
const payment = await sahelpay.payments.create({
  amount: 5000,
  currency: "XOF",
  provider: "ORANGE_MONEY",
  customer_phone: "+22370000000",
  description: "Commande #123",
  metadata: { order_id: "123" },
  callback_url: "https://votre-site.com/webhook",
  return_url: "https://votre-site.com/success",
});

// Vérifier le statut
const status = await sahelpay.payments.checkStatus("SP_xxx");
console.log(status.status); // 'SUCCESS' | 'PENDING' | 'FAILED'

// Récupérer un paiement
const payment = await sahelpay.payments.retrieve("SP_xxx");

// Lister les paiements
const { payments, pagination } = await sahelpay.payments.list({
  limit: 20,
  page: 1,
  status: "SUCCESS",
});
```

### Liens de paiement

```typescript
// Créer un lien de paiement
const link = await sahelpay.paymentLinks.create({
  title: "Formation React",
  price: 25000,
  currency: "XOF",
  redirect_url: "https://votre-site.com/merci",
});

console.log(link.url); // https://pay.sahelpay.ml/p/formation-react

// Lister les liens
const links = await sahelpay.paymentLinks.list();

// Désactiver un lien
await sahelpay.paymentLinks.deactivate("link_id");
```

### Payouts (Envoi d'argent)

```typescript
// Envoyer de l'argent
const payout = await sahelpay.payouts.create({
  amount: 100000,
  provider: "WAVE",
  recipient_phone: "+22377000000",
  recipient_name: "Fournisseur SARL",
  description: "Paiement facture #456",
  type: "SUPPLIER_PAYMENT", // Optionnel
});

console.log(payout.reference); // PAY_xxx
console.log(payout.status); // PENDING | PROCESSING | COMPLETED | FAILED

// Récupérer un payout
const payout = await sahelpay.payouts.retrieve("PAY_xxx");

// Lister les payouts
const { payouts, pagination } = await sahelpay.payouts.list({
  limit: 20,
  status: "COMPLETED",
});

// Annuler un payout en attente
await sahelpay.payouts.cancel("PAY_xxx");

// Statistiques
const stats = await sahelpay.payouts.stats();
console.log(stats.total_volume); // Volume total envoyé
console.log(stats.success_rate); // Taux de succès

// Attendre la fin d'un payout (polling)
const completedPayout = await sahelpay.payouts.poll("PAY_xxx", {
  onStatus: (status, payout) => console.log(`Status: ${status}`),
});
```

### Webhooks

```typescript
import express from "express";
import SahelPay from "@sahelpay/sdk";

const app = express();
const sahelpay = new SahelPay({ secretKey: "sk_live_xxx" });

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const signature = req.headers["x-sahelpay-signature"] as string;
  const webhookSecret = "whsec_xxx"; // Votre secret webhook

  try {
    const event = sahelpay.webhooks.parseEvent(
      req.body.toString(),
      signature,
      webhookSecret
    );

    switch (event.event) {
      case "payment.success":
        console.log("Paiement réussi:", event.data.reference_id);
        // Mettre à jour votre commande
        break;
      case "payment.failed":
        console.log("Paiement échoué:", event.data.reference_id);
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).send("Webhook Error");
  }
});
```

## Intégration E-commerce

### WooCommerce (WordPress)

```php
// Voir le plugin WordPress: @sahelpay/woocommerce
```

### Shopify

```javascript
// Dans votre app Shopify
import SahelPay from "@sahelpay/sdk";

export async function createCheckout(order) {
  const sahelpay = new SahelPay({ secretKey: process.env.SAHELPAY_SECRET_KEY });

  const payment = await sahelpay.payments.create({
    amount: order.total,
    provider: order.paymentMethod,
    customer_phone: order.phone,
    description: `Commande ${order.id}`,
    metadata: { shopify_order_id: order.id },
    return_url: `https://votre-boutique.com/orders/${order.id}/confirm`,
  });

  return payment;
}
```

### Next.js / React

```tsx
// pages/api/checkout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import SahelPay from "@sahelpay/sdk";

const sahelpay = new SahelPay({
  secretKey: process.env.SAHELPAY_SECRET_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, phone, provider } = req.body;

  try {
    const payment = await sahelpay.payments.create({
      amount,
      provider,
      customer_phone: phone,
      description: "Achat en ligne",
      return_url: `${process.env.NEXT_PUBLIC_URL}/success`,
    });

    res.json({ payment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
```

## Gestion des erreurs

```typescript
import SahelPay, { SahelPayError } from '@sahelpay/sdk';

try {
  const payment = await sahelpay.payments.create({ ... });
} catch (error) {
  if (error instanceof SahelPayError) {
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Status:', error.statusCode);

    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        // Solde insuffisant
        break;
      case 'INVALID_PHONE':
        // Numéro invalide
        break;
      case 'PROVIDER_ERROR':
        // Erreur du provider
        break;
    }
  }
}
```

## TypeScript

Le SDK est entièrement typé. Les types sont inclus automatiquement.

```typescript
import SahelPay, {
  Payment,
  PaymentLink,
  CreatePaymentParams,
  SahelPayConfig,
} from "@sahelpay/sdk";
```

## Support

- Documentation: https://docs.sahelpay.ml
- Email: dev@sahelpay.ml
- GitHub Issues: https://github.com/sahelpay/sahelpay-js/issues

## License

MIT
