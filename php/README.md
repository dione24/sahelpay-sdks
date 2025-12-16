# SahelPay PHP SDK

SDK PHP officiel pour intégrer les paiements Mobile Money SahelPay dans vos applications PHP/Laravel.

## 📦 Installation

```bash
composer require sahelpay/sahelpay-php
```

> Note: tant que le package n’est pas publié sur Packagist, installez-le depuis ce monorepo (path repository).
> Voir `../README.md` (racine du repo) pour la procédure complète.

## 🚀 Démarrage Rapide

### Initialisation

```php
<?php

use SahelPay\SahelPay;

// Option 1: Initialisation directe
$sahelpay = new SahelPay(
    'sk_live_your_secret_key',
    'pk_live_your_public_key'
);

// Option 2: Depuis les variables d'environnement
$sahelpay = SahelPay::fromEnv();

// Option 3: Avec options avancées
$sahelpay = new SahelPay(
    'sk_live_your_secret_key',
    'pk_live_your_public_key',
    [
        'webhook_secret' => 'whsec_xxx',
        'sandbox' => false,
        'timeout' => 30,
    ]
);
```

## 💳 Paiements Mobile Money

### Initier un Paiement

```php
$payment = $sahelpay->payments->initiate([
    'amount' => 5000, // 5,000 FCFA
    'provider' => 'ORANGE_MONEY', // ORANGE_MONEY, WAVE, MOOV
    'customer_phone' => '+22370123456',
    'customer_name' => 'Amadou Diallo',
    'description' => 'Achat T-shirt',
    'callback_url' => 'https://votresite.ml/webhook',
    'metadata' => [
        'order_id' => 'ORD-12345',
    ],
]);

echo $payment->reference_id; // SP-170188-A1B2
echo $payment->status;       // pending
echo $payment->ussd_code;    // *144*4*...*1#
```

### Vérifier le Statut

```php
$status = $sahelpay->payments->verify('SP-170188-A1B2');

if ($status->status === 'success') {
    echo "Paiement réussi !";
    echo "Montant: " . $status->amount . " FCFA";
} elseif ($status->status === 'pending') {
    echo "En attente de validation client";
} else {
    echo "Échec: " . $status->failure_reason;
}
```

### Lister les Transactions

```php
$transactions = $sahelpay->transactions->all([
    'limit' => 20,
    'status' => 'success',
]);

foreach ($transactions->getData()['transactions'] as $tx) {
    echo $tx['reference_id'] . ": " . $tx['amount'] . " FCFA\n";
}
```

## 🔗 Liens de Paiement

### Créer un Lien

```php
$link = $sahelpay->paymentLinks->create([
    'amount' => 25000, // 25,000 FCFA
    'title' => 'Formation DevOps',
    'description' => 'Cours complet DevOps avec certifications',
    'max_uses' => 50,
]);

echo $link->url;  // https://sahelpay.ml/pay/abc123
echo $link->slug; // abc123
```

### Obtenir le QR Code

```php
$qr = $sahelpay->paymentLinks->qrCode('abc123');
echo $qr->qr_code; // data:image/png;base64,...
```

## 💰 Payouts (Envoi d'Argent)

### Envoyer de l'Argent

```php
$payout = $sahelpay->payouts->create([
    'amount' => 100000, // 100,000 FCFA
    'provider' => 'WAVE',
    'recipient_phone' => '+22377000000',
    'recipient_name' => 'Fournisseur SARL',
    'description' => 'Paiement facture #456',
    'type' => 'SUPPLIER_PAYMENT', // Optionnel
]);

echo $payout->reference;  // PAY_xxx
echo $payout->status;     // pending, processing, completed, failed
echo $payout->fee;        // Frais appliqués
```

### Vérifier un Payout

```php
$payout = $sahelpay->payouts->get('PAY_xxx');

if ($payout->status === 'completed') {
    echo "Envoi réussi !";
}
```

### Annuler un Payout

```php
$result = $sahelpay->payouts->cancel('PAY_xxx');
echo "Payout annulé, marchand remboursé";
```

## 🔔 Webhooks

### Valider et Traiter un Webhook

```php
<?php
// Dans votre controller webhook

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SAHELPAY_SIGNATURE'] ?? '';

// Vérifier la signature
if (!$sahelpay->webhooks->verify($payload, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}

// Parser l'événement
$event = $sahelpay->webhooks->parse($payload);

switch ($event->getType()) {
    case 'payment.success':
        $referenceId = $event->getReferenceId();
        // Marquer la commande comme payée
        Order::where('payment_ref', $referenceId)->update(['status' => 'paid']);
        break;

    case 'payment.failed':
        // Gérer l'échec
        break;

    case 'payout.completed':
        // Payout envoyé avec succès
        break;
}

http_response_code(200);
echo json_encode(['status' => 'ok']);
```

## 🔧 Intégration Laravel

### Configuration

Après l'installation, publiez le fichier de configuration :

```bash
php artisan vendor:publish --provider="SahelPay\Laravel\SahelPayServiceProvider"
```

Ajoutez vos clés dans `.env` :

```env
SAHELPAY_SECRET_KEY=sk_live_xxx
SAHELPAY_PUBLIC_KEY=pk_live_xxx
SAHELPAY_WEBHOOK_SECRET=whsec_xxx
SAHELPAY_SANDBOX=false
```

### Utilisation avec Facade

```php
use SahelPay\Laravel\Facades\SahelPay;

// Initier un paiement
$payment = SahelPay::payments->initiate([
    'amount' => 5000,
    'provider' => 'ORANGE_MONEY',
    'customer_phone' => '+22370123456',
]);
```

### Injection de Dépendance

```php
use SahelPay\SahelPay;

class CheckoutController extends Controller
{
    public function process(Request $request, SahelPay $sahelpay)
    {
        $payment = $sahelpay->payments->initiate([
            'amount' => $request->amount,
            'provider' => $request->provider,
            'customer_phone' => $request->phone,
        ]);

        return response()->json($payment->toArray());
    }
}
```

### Controller Webhook Laravel

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use SahelPay\SahelPay;

class WebhookController extends Controller
{
    public function handle(Request $request, SahelPay $sahelpay)
    {
        $signature = $request->header('X-SahelPay-Signature');
        $payload = $request->getContent();

        if (!$sahelpay->webhooks->verify($payload, $signature)) {
            return response('Invalid signature', 401);
        }

        $event = $sahelpay->webhooks->parse($payload);

        if ($event->isSuccess()) {
            // Traiter le paiement réussi
            $order = Order::where('payment_ref', $event->getReferenceId())->first();
            $order?->markAsPaid();
        }

        return response()->json(['status' => 'ok']);
    }
}
```

## ⚠️ Gestion des Erreurs

```php
use SahelPay\Exceptions\AuthenticationException;
use SahelPay\Exceptions\ValidationException;
use SahelPay\Exceptions\ApiException;

try {
    $payment = $sahelpay->payments->initiate([...]);
} catch (AuthenticationException $e) {
    // Clé API invalide
    echo "Erreur d'authentification: " . $e->getMessage();
} catch (ValidationException $e) {
    // Paramètres invalides
    echo "Erreur de validation: " . $e->getMessage();
    foreach ($e->getErrors() as $field => $errors) {
        echo "$field: " . implode(', ', $errors);
    }
} catch (ApiException $e) {
    // Autre erreur API
    echo "Erreur API: " . $e->getMessage();
    echo "Code: " . $e->getErrorCode();
}
```

## 📋 Providers Supportés

| Provider     | Code           | Pays                         |
| ------------ | -------------- | ---------------------------- |
| Orange Money | `ORANGE_MONEY` | Mali, Sénégal, Côte d'Ivoire |
| Wave         | `WAVE`         | Mali, Sénégal                |
| Moov Money   | `MOOV`         | Mali, Bénin                  |

## 🧪 Mode Sandbox

Le SDK détecte automatiquement le mode sandbox si votre clé secrète commence par `sk_test_` :

```php
$sahelpay = new SahelPay('sk_test_xxx', 'pk_test_xxx');
// Mode sandbox activé automatiquement
```

Ou forcez-le manuellement :

```php
$sahelpay = new SahelPay('sk_xxx', 'pk_xxx', ['sandbox' => true]);
```

## 📞 Support

- **Documentation** : [https://docs.sahelpay.ml](https://docs.sahelpay.ml)
- **Dashboard** : [https://dashboard.sahelpay.ml](https://dashboard.sahelpay.ml)
- **Email** : support@sahelpay.ml

## 📜 Licence

MIT License - voir [LICENSE](LICENSE) pour plus de détails.
