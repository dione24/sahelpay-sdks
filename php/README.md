# SahelPay PHP SDK

SDK PHP officiel pour intégrer les paiements SahelPay (Orange Money, Mali) dans vos applications PHP 8+ et Laravel. Documentation : [docs.sahelpay.ml](https://docs.sahelpay.ml)

## Installation

Le paquet `sahelpay/sahelpay-php` n'est pas encore publié sur Packagist. Installez-le depuis ce dépôt (path repository) :

```json
{
  "repositories": [{ "type": "path", "url": "../sahelpay-sdks/php" }]
}
```

```bash
composer require sahelpay/sahelpay-php:"*"
```

## Initialisation

```php
<?php

use SahelPay\SahelPay;

// Clé secrète seule
$sahelpay = new SahelPay(getenv('SAHELPAY_SECRET_KEY'));

// Depuis l'environnement (SAHELPAY_SECRET_KEY, SAHELPAY_PUBLIC_KEY, SAHELPAY_WEBHOOK_SECRET)
$sahelpay = SahelPay::fromEnv();

// Avec options
$sahelpay = new SahelPay(
    'sk_live_xxx',
    null,
    [
        'webhook_secret' => 'whsec_xxx', // requis pour vérifier les webhooks
        'timeout' => 30,
    ]
);
```

La base URL est `https://api.sahelpay.ml` en sandbox comme en production : la clé (`sk_test_...` / `sk_live_...`) détermine le mode.

## Sandbox et production

- **Sandbox** (`sk_test_...`) : gratuite, sans abonnement.
- **Production** (`sk_live_...`) : KYC approuvé, accès production ouvert par SahelPay et **abonnement SahelPay payé en cours** (`403 PAID_SUBSCRIPTION_REQUIRED` sinon). Plafond mensuel live selon le forfait (200 000 FCFA pour Starter et Pro, `403 PLAN_MONTHLY_VOLUME_EXCEEDED`).

## Paiements Orange Money

**Orange Money est le seul moyen de paiement** ; tout autre `provider` est rejeté (`400`).

### Initier un paiement

```php
$payment = $sahelpay->payments->initiate([
    'amount' => 5000,
    'provider' => 'ORANGE_MONEY',
    'customer_phone' => '+22370123456',
    'customer_name' => 'Amadou Diallo',
    'description' => 'Achat T-shirt',
    'client_reference' => 'ORD-12345',
    'return_url' => 'https://votresite.ml/merci?order=ORD-12345',
    'idempotency_key' => 'ORD-12345', // obligatoire côté API : toujours la fournir
]);

echo $payment->id;
header('Location: ' . $payment->redirect_url); // checkout SahelPay (hosted_checkout true par défaut)
```

- `X-Idempotency-Key` est obligatoire côté API. Sans `idempotency_key`, le SDK génère une clé aléatoire à chaque appel : un retry créerait alors un second paiement. Passez une clé stable liée à votre commande.
- Après un paiement confirmé, le client est renvoyé automatiquement vers `return_url` (HTTPS, hors domaines SahelPay).
- Partenaires SPAY : ajoutez `'items' => [['product_id' => '...', 'quantity' => 1]]` (transmis tel quel).

### Vérifier le statut

```php
$status = $sahelpay->payments->verify($payment->id); // GET /v1/payments/{id}/status

switch ($status->status) {
    case 'SUCCESS': echo "Paiement réussi"; break;
    case 'PENDING':
    case 'INITIATED': echo "En attente de validation client"; break;
    default: echo "Paiement non abouti ({$status->status})"; // FAILED, EXPIRED
}

$byOrder = $sahelpay->payments->search('ORD-12345'); // par client_reference
$details = $sahelpay->payments->details($payment->id);
$sahelpay->payments->reconcile($payment->id);
```

> `payments->all()` / `transactions->all()` lisent `GET /v1/payments/history`, qui ne contient pas les paiements créés via `POST /v1/payments`.

## Tests

Deux options, réservées aux clés de test :

- `'mock' => true` → simulateur SahelPay, aucun appel opérateur. Statut final selon le montant : `4000` réussi, `4001` échoué, `4002` en attente, `4003` erreur opérateur.
- `'sandbox' => true` → environnement de test d'Orange.

```php
$payment = $sahelpay->payments->initiate([
    'amount' => 4000,
    'provider' => 'ORANGE_MONEY',
    'customer_phone' => '+22370123456',
    'hosted_checkout' => false, // la simulation démarre à l'initiation
    'mock' => true,
    'idempotency_key' => 'test-4000-1',
]);

echo $sahelpay->payments->verify($payment->id)->status; // SUCCESS

$sahelpay->webhooks->test(); // envoie webhook.test vers l'URL configurée
```

## Liens de paiement

```php
$link = $sahelpay->paymentLinks->create([
    'title' => 'Formation DevOps',
    'price' => 25000,
    'description' => 'Cours complet DevOps',
    'max_uses' => 50,
]);

echo $sahelpay->paymentLinks->getUrl($link->slug); // https://pay.sahelpay.ml/<slug>

$qr = $sahelpay->paymentLinks->qrCode($link->slug);
echo $qr->qr_code;
```

## Webhooks

```php
<?php

use SahelPay\Exceptions\WebhookSignatureException;

$payload = file_get_contents('php://input'); // corps brut
$signature = $_SERVER['HTTP_X_SAHELPAY_SIGNATURE'] ?? '';

try {
    $event = $sahelpay->webhooks->constructEvent($payload, $signature); // utilise webhook_secret
} catch (WebhookSignatureException $e) {
    http_response_code(401);
    exit('Invalid signature');
}

switch ($event->getType()) {
    case 'payment.success':
        $orderRef = $event->getReferenceId(); // client_reference (ou id du paiement)
        // Marquer la commande comme payée
        break;
    case 'payment.failed':
    case 'payment.expired':
        break;
}

http_response_code(200);
echo json_encode(['received' => true]);
```

Événements émis : `payment.success`, `payment.failed`, `payment.pending`, `payment.expired`, `payment.updated`, `secure_order.*`, `invoice.created`, `invoice.paid`, `subscription.payment_due`, `subscription.renewed`, `webhook.test`. Aucun `payout.*`, `refund.*` ni `payment.cancelled`.

## Intégration Laravel

```bash
php artisan vendor:publish --provider="SahelPay\Laravel\SahelPayServiceProvider"
```

```env
SAHELPAY_SECRET_KEY=sk_live_xxx
SAHELPAY_WEBHOOK_SECRET=whsec_xxx
```

Le service provider enregistre `SahelPay\SahelPay` en singleton : injectez-le.

```php
use Illuminate\Http\Request;
use SahelPay\SahelPay;
use SahelPay\Exceptions\WebhookSignatureException;

class WebhookController extends Controller
{
    public function handle(Request $request, SahelPay $sahelpay)
    {
        try {
            $event = $sahelpay->webhooks->constructEvent(
                $request->getContent(),                       // jamais $request->all()
                $request->header('X-SahelPay-Signature', '')
            );
        } catch (WebhookSignatureException $e) {
            return response('Invalid signature', 401);
        }

        if ($event->getType() === 'payment.success') {
            Order::where('reference', $event->getReferenceId())->first()?->markAsPaid();
        }

        return response()->json(['received' => true]);
    }
}
```

## Gestion des erreurs

```php
use SahelPay\Exceptions\AuthenticationException;
use SahelPay\Exceptions\ValidationException;
use SahelPay\Exceptions\ApiException;

try {
    $payment = $sahelpay->payments->initiate([...]);
} catch (AuthenticationException $e) {
    // 401 : clé invalide, clé live sans accès production
} catch (ValidationException $e) {
    // 400 / 422 : getErrorCode() = error.code (BAD_REQUEST, VALIDATION_ERROR, …)
    print_r($e->getErrors()); // error.details
} catch (ApiException $e) {
    // 403 (abonnement, plafond), 409, 503…
    echo $e->getErrorCode() . ' - ' . $e->getMessage();
    echo $e->getHttpStatus();
}
```

## Ressources à éviter pour l'instant

| Ressource | Raison |
| --- | --- |
| `payouts` | Payouts automatiques indisponibles côté API ; utilisez `withdrawals` |
| `refunds` | Remboursements en ligne désactivés (`503`), passer par le support |

## Support

- **Documentation** : [https://docs.sahelpay.ml](https://docs.sahelpay.ml)
- **Dashboard** : [https://app.sahelpay.ml](https://app.sahelpay.ml/dashboard)
- **Email** : support@sahelpay.africa

## Licence

MIT License - voir [LICENSE](LICENSE) pour plus de détails.
