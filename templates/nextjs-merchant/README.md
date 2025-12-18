# Template Next.js - Marchand SahelPay

Template prêt à l'emploi pour intégrer SahelPay dans une application Next.js.

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
    payments/create/route.ts    # Créer un paiement
    webhooks/sahelpay/route.ts  # Recevoir les webhooks
  checkout/return/page.tsx      # Page retour après paiement
components/
  sahelpay-button.tsx           # Bouton "Payer avec SahelPay"
lib/
  sahelpay.ts                   # Utilitaires
```

---

## ⚠️ Règles

- **Webhook = source de vérité** pour le statut paiement
- **Clé secrète côté serveur uniquement**
- **Toujours vérifier la signature webhook**
