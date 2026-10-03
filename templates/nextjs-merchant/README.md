# Template Next.js - Marchand SahelPay

Template prêt à l'emploi pour intégrer SahelPay dans une application Next.js.

> Important: ce template couvre le flow API SahelPay de bout en bout, mais vous devez brancher votre propre persistance métier (orders/payments) côté application avant mise en production.

## 🚀 Démarrage rapide (5 étapes)

### 1. Copier les fichiers

```bash
cp -r templates/nextjs-merchant/* votre-projet/
```

### 2. Configurer les variables d'environnement

```env
# .env.local
SAHELPAY_API_URL=https://api.sahelpay.ml
SAHELPAY_SECRET_KEY=sk_live_xxx
SAHELPAY_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_APP_URL=https://votre-app.com
```

### 3. Utiliser le bouton de paiement

```tsx
import { SahelPayButton } from "@/components/sahelpay-button";

<SahelPayButton
  orderId="order_123"
  amount={5000}
  customerPhone="+22370000000"
/>;
```

### 4. Configurer le webhook dans le dashboard SahelPay

URL: `https://votre-app.com/api/webhooks/sahelpay`

### 5. Tester

```bash
npm run dev
```

---

## 📁 Fichiers inclus

```
app/
  api/
    payments/create/route.ts    # Créer un paiement (Orange Money, X-Idempotency-Key)
    payments/status/route.ts    # Vérifier le statut d'un paiement
    webhooks/sahelpay/route.ts  # Recevoir les webhooks
  checkout/return/page.tsx      # Page retour après paiement
components/
  sahelpay-button.tsx           # Bouton "Payer avec SahelPay"
```

---

## ⚠️ Règles

- **Webhook = source de vérité** pour le statut paiement
- **Clé secrète côté serveur uniquement**
- **Toujours vérifier la signature webhook**
- Orange Money est le seul moyen de paiement ; `X-Idempotency-Key` est obligatoire.
- En production, il faut un KYC approuvé, l'accès production ouvert par SahelPay et un **abonnement SahelPay payé** ; la sandbox (`sk_test_...`) est gratuite. Plafond mensuel live : 200 000 FCFA (Starter, Pro).

## Contrat webhook / retour

- **Webhook** : la commande se retrouve via `data.client_reference` (= `order_id` envoyé à la création). Traitez `payment.success`, `payment.failed`, `payment.expired` (et éventuellement `payment.pending`, `payment.updated`). `payment.cancelled` n'est jamais émis.
- **Page de retour** : SahelPay redirige vers `return_url` telle quelle (sans `payment_intent_id`). Le template passe `order_id` dans l'URL et vérifie le statut via `GET /v1/payments/search?client_reference=...` côté serveur.
