<?php

declare(strict_types=1);

namespace SahelPay;

use SahelPay\Http\Client;
use SahelPay\Resources\Payment;
use SahelPay\Resources\PaymentLink;
use SahelPay\Resources\Payout;
use SahelPay\Resources\Transaction;
use SahelPay\Resources\Webhook;
use SahelPay\Resources\Plan;
use SahelPay\Resources\Subscription;
use SahelPay\Resources\Customer;
use SahelPay\Resources\Portal;

/**
 * Client principal SahelPay
 *
 * @property-read Payment $payments
 * @property-read PaymentLink $paymentLinks
 * @property-read Payout $payouts
 * @property-read Transaction $transactions
 * @property-read Webhook $webhooks
 * @property-read Plan $plans
 * @property-read Subscription $subscriptions
 * @property-read Customer $customers
 * @property-read Portal $portal
 */
class SahelPay
{
    private Config $config;
    private Client $client;

    // Resources
    public Payment $payments;
    public PaymentLink $paymentLinks;
    public Payout $payouts;
    public Transaction $transactions;
    public Webhook $webhooks;
    public Plan $plans;
    public Subscription $subscriptions;
    public Customer $customers;
    public Portal $portal;

    /**
     * Créer une nouvelle instance SahelPay
     *
     * @param string $secretKey Votre clé secrète (sk_live_xxx ou sk_test_xxx)
     * @param string $publicKey Votre clé publique (pk_live_xxx ou pk_test_xxx)
     * @param array{
     *   webhook_secret?: string,
     *   sandbox?: bool,
     *   timeout?: int,
     *   base_url?: string
     * } $options Options de configuration
     */
    public function __construct(
        string $secretKey,
        string $publicKey,
        array $options = []
    ) {
        // Déterminer si on est en mode sandbox
        $sandbox = $options['sandbox'] ?? str_starts_with($secretKey, 'sk_test_');
        
        $this->config = new Config(
            $secretKey,
            $publicKey,
            $options['webhook_secret'] ?? null,
            $sandbox,
            $options['timeout'] ?? 30
        );

        // Override base URL si spécifiée
        if (isset($options['base_url'])) {
            $this->config->setBaseUrl($options['base_url']);
        }

        $this->client = new Client($this->config);

        // Initialiser les resources
        $this->payments = new Payment($this->client);
        $this->paymentLinks = new PaymentLink($this->client);
        $this->payouts = new Payout($this->client);
        $this->transactions = new Transaction($this->client);
        $this->webhooks = new Webhook($this->config);
        $this->plans = new Plan($this->client);
        $this->subscriptions = new Subscription($this->client);
        $this->customers = new Customer($this->client);
        $this->portal = new Portal($this->client);
    }

    /**
     * Obtenir la configuration
     */
    public function getConfig(): Config
    {
        return $this->config;
    }

    /**
     * Vérifier si on est en mode sandbox
     */
    public function isSandbox(): bool
    {
        return $this->config->isSandbox();
    }

    /**
     * Créer une instance depuis les variables d'environnement
     */
    public static function fromEnv(): self
    {
        $secretKey = getenv('SAHELPAY_SECRET_KEY') ?: $_ENV['SAHELPAY_SECRET_KEY'] ?? '';
        $publicKey = getenv('SAHELPAY_PUBLIC_KEY') ?: $_ENV['SAHELPAY_PUBLIC_KEY'] ?? '';
        $webhookSecret = getenv('SAHELPAY_WEBHOOK_SECRET') ?: $_ENV['SAHELPAY_WEBHOOK_SECRET'] ?? null;
        
        if (empty($secretKey) || empty($publicKey)) {
            throw new \RuntimeException(
                "SAHELPAY_SECRET_KEY et SAHELPAY_PUBLIC_KEY doivent être définis"
            );
        }

        return new self($secretKey, $publicKey, [
            'webhook_secret' => $webhookSecret,
        ]);
    }
}