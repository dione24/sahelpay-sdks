<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Clés API SahelPay
    |--------------------------------------------------------------------------
    |
    | Vos clés API SahelPay. Vous pouvez les trouver dans votre dashboard
    | SahelPay sous Paramètres > Développeurs > Clés API.
    |
    */
    
    'secret_key' => env('SAHELPAY_SECRET_KEY'),
    'public_key' => env('SAHELPAY_PUBLIC_KEY'),

    /*
    |--------------------------------------------------------------------------
    | Webhook Secret
    |--------------------------------------------------------------------------
    |
    | Secret utilisé pour valider les signatures des webhooks SahelPay.
    | Requis pour utiliser la validation de webhook.
    |
    */

    'webhook_secret' => env('SAHELPAY_WEBHOOK_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Mode Sandbox
    |--------------------------------------------------------------------------
    |
    | Activer le mode sandbox pour les tests. Laissez à null pour détection
    | automatique basée sur le préfixe de la clé API (sk_test_ = sandbox).
    |
    */

    'sandbox' => env('SAHELPAY_SANDBOX', null),

    /*
    |--------------------------------------------------------------------------
    | Timeout
    |--------------------------------------------------------------------------
    |
    | Timeout en secondes pour les requêtes API.
    |
    */

    'timeout' => env('SAHELPAY_TIMEOUT', 30),

    /*
    |--------------------------------------------------------------------------
    | Base URL
    |--------------------------------------------------------------------------
    |
    | URL de base de l'API (optionnel, utile pour les tests locaux).
    |
    */

    'base_url' => env('SAHELPAY_BASE_URL'),
];
