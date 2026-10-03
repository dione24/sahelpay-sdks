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
use SahelPay\Resources\Refund;
use SahelPay\Resources\Withdrawal;

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
 * @property-read Refund $refunds
 * @property-read Withdrawal $withdrawals
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
    public Refund $refunds;
    public Withdrawal $withdrawals;

    /**
     * Créer une nouvelle instance SahelPay
     *
     * @param string $secretKey Votre clé secrète (sk_live_xxx ou sk_test_xxx)
     * @param string|null $publicKey Votre clé publique (optionnelle)
     * @param array{
     *   webhook_secret?: string,
     *   sandbox?: bool,
     *   timeout?: int,
     *   base_url?: string,
     *   handler?: callable
     * } $options Options de configuration (`handler` : handler Guzzle, utile pour les tests)
     */
    public function __construct(
        string $secretKey,
        ?string $publicKey = null,
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

        $this->client = new Client($this->config, $options['handler'] ?? null);

        // Initialiser les resources
        $this->payments = new Payment($this->client);
        $this->paymentLinks = new PaymentLink($this->client);
        $this->payouts = new Payout($this->client);
        $this->transactions = new Transaction($this->client);
        $this->webhooks = new Webhook($this->config, $this->client);
        $this->plans = new Plan($this->client);
        $this->subscriptions = new Subscription($this->client);
        $this->customers = new Customer($this->client);
        $this->portal = new Portal($this->client);
        $this->refunds = new Refund($this->client);
        $this->withdrawals = new Withdrawal($this->client);
    }

    // Accesseurs (utilisables via la façade Laravel : SahelPay::payments()->initiate(...))
    public function payments(): Payment { return $this->payments; }
    public function paymentLinks(): PaymentLink { return $this->paymentLinks; }
    /** @deprecated Les payouts sont refusés par la plateforme. Utilisez withdrawals(). */
    public function payouts(): Payout { return $this->payouts; }
    public function transactions(): Transaction { return $this->transactions; }
    public function webhooks(): Webhook { return $this->webhooks; }
    public function plans(): Plan { return $this->plans; }
    public function subscriptions(): Subscription { return $this->subscriptions; }
    public function customers(): Customer { return $this->customers; }
    public function portal(): Portal { return $this->portal; }
    public function refunds(): Refund { return $this->refunds; }
    public function withdrawals(): Withdrawal { return $this->withdrawals; }

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
        $publicKey = getenv('SAHELPAY_PUBLIC_KEY') ?: $_ENV['SAHELPAY_PUBLIC_KEY'] ?? null;
        $webhookSecret = getenv('SAHELPAY_WEBHOOK_SECRET') ?: $_ENV['SAHELPAY_WEBHOOK_SECRET'] ?? null;
        
        if (empty($secretKey)) {
            throw new \RuntimeException(
                "SAHELPAY_SECRET_KEY doit être définie"
            );
        }

        return new self($secretKey, $publicKey, [
            'webhook_secret' => $webhookSecret,
        ]);
    }
}
