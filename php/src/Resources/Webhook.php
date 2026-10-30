<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Config;
use SahelPay\Exceptions\WebhookSignatureException;
use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour la validation des webhooks
 * 
 * SahelPay utilise un format de signature Stripe-like:
 * - Header: X-SahelPay-Signature
 * - Format: t=<timestamp>,v1=<signature>
 * - Signature: HMAC_SHA256(secret, "${timestamp}.${raw_body}")
 */
class Webhook
{
    private Config $config;
    private ?Client $client;

    /**
     * Tolérance par défaut pour le timestamp (5 minutes)
     */
    private const DEFAULT_TOLERANCE = 300;

    public function __construct(Config $config, ?Client $client = null)
    {
        $this->config = $config;
        $this->client = $client;
    }

    /**
     * Déclencher un webhook de connectivité vers l'URL configurée du marchand.
     */
    public function test(): Response
    {
        if (!$this->client) {
            throw new \RuntimeException("Client HTTP non configuré pour envoyer un webhook de test");
        }

        return $this->client->post('/webhooks/test');
    }

    /**
     * Historique des livraisons (paginé).
     *
     * @param array{page?: int, limit?: int, status?: string, event_type?: string, application_id?: string, endpoint_id?: string} $query
     */
    public function logs(array $query = []): Response
    {
        return $this->http()->get('/webhooks/logs', $query);
    }

    /**
     * Détail d'une livraison.
     */
    public function log(string $logId): Response
    {
        return $this->http()->get('/webhooks/logs/' . rawurlencode($logId));
    }

    /**
     * Relancer une livraison échouée (10 par minute).
     */
    public function retry(string $logId): Response
    {
        return $this->http()->post('/webhooks/logs/' . rawurlencode($logId) . '/retry');
    }

    /**
     * Statistiques de livraison.
     */
    public function stats(array $query = []): Response
    {
        return $this->http()->get('/webhooks/stats', $query);
    }

    /**
     * Derniers événements émis (clé de test uniquement : 403 en live).
     *
     * @param array{after?: string, limit?: int, application_id?: string} $query
     */
    public function events(array $query = []): Response
    {
        return $this->http()->get('/webhooks/events', $query);
    }

    /**
     * Un événement par son id (evt_...).
     */
    public function event(string $eventId): Response
    {
        return $this->http()->get('/webhooks/events/' . rawurlencode($eventId));
    }

    private function http(): Client
    {
        if (!$this->client) {
            throw new \RuntimeException("Client HTTP non configuré");
        }
        return $this->client;
    }

    /**
     * Vérifier la signature d'un webhook.
     *
     * Format : X-SahelPay-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>.
     *
     * @return bool True si la signature est valide, false sinon (y compris replay hors tolérance)
     */
    public function verify(string $payload, string $signatureHeader, int $tolerance = self::DEFAULT_TOLERANCE): bool
    {
        $secret = $this->config->getWebhookSecret();
        
        if (!$secret) {
            throw new \RuntimeException("Webhook secret non configuré");
        }

        $parts = $this->parseSignatureHeader($signatureHeader);
        $timestamp = $parts['t'] ?? null;
        $signature = $parts['v1'] ?? null;

        if ($timestamp !== null && $signature !== null) {
            if (!ctype_digit($timestamp)) {
                return false;
            }

            if (abs(time() - (int) $timestamp) > $tolerance) {
                return false;
            }

            $expectedSignature = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
            return hash_equals($expectedSignature, $signature);
        }

        // Seul le format t=...,v1=... est émis par SahelPay. Un HMAC nu du corps
        // (ancien format, sans horodatage) n'offre aucune protection contre le rejeu.
        return false;
    }

    /**
     * Construire et vérifier un événement webhook
     *
     * @throws WebhookSignatureException Si la signature est invalide
     */
    public function constructEvent(string $payload, string $signatureHeader, int $tolerance = self::DEFAULT_TOLERANCE): WebhookEvent
    {
        if (!$this->verify($payload, $signatureHeader, $tolerance)) {
            throw new WebhookSignatureException('Invalid webhook signature');
        }
        return $this->parse($payload);
    }

    /**
     * Parser le header de signature
     * 
     * @param string $header Format: "t=123456789,v1=abc123..."
     * @return array<string, string> Les parties parsées
     */
    private function parseSignatureHeader(string $header): array
    {
        $parts = [];
        
        foreach (explode(',', $header) as $part) {
            $segments = explode('=', $part, 2);
            if (count($segments) === 2) {
                $parts[$segments[0]] = $segments[1];
            }
        }
        
        return $parts;
    }

    /**
     * Parser le payload d'un webhook
     */
    public function parse(string $payload): WebhookEvent
    {
        $data = json_decode($payload, true);
        
        if (!$data) {
            throw new \InvalidArgumentException("Payload JSON invalide");
        }

        return new WebhookEvent($data);
    }

    /**
     * Construire une réponse de succès pour le webhook
     */
    public function success(): array
    {
        return ['status' => 'ok'];
    }
}

/**
 * Représentation d'un événement webhook
 * @phpstan-import-type InvoicePaidData from \SahelPay\BillingTypes
 * @phpstan-import-type SubscriptionCancelledData from \SahelPay\BillingTypes
 * @phpstan-import-type SubscriptionRenewedData from \SahelPay\BillingTypes
 * @phpstan-import-type InvoiceCreatedData from \SahelPay\BillingTypes
 * @phpstan-import-type SubscriptionPaymentDueData from \SahelPay\BillingTypes
 */
class WebhookEvent
{
    public const EVENTS = [
        'payment.success',
        'payment.failed',
        'payment.pending',
        'payment.expired',
        'payment.updated',
        'secure_order.paid',
        'secure_order.released',
        'secure_order.refunded',
        'secure_order.disputed',
        'secure_order.cancelled',
        'subscription.renewed',
        'subscription.cancelled',
        'subscription.payment_due',
        'invoice.created',
        'invoice.paid',
        'webhook.test',
    ];

    private array $data;

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    /**
     * Obtenir le type d'événement
     */
    public function getType(): string
    {
        return $this->data['event'] ?? $this->data['type'] ?? 'unknown';
    }

    /**
     * Obtenir les données de l'événement
     */
    public function getData(): array
    {
        return $this->data['data'] ?? $this->data;
    }

    public function getId(): string
    {
        return $this->data['id'] ?? '';
    }

    public function getLivemode(): ?bool
    {
        return $this->data['livemode'] ?? null;
    }

    /** @return InvoicePaidData|SubscriptionRenewedData|SubscriptionCancelledData|InvoiceCreatedData|SubscriptionPaymentDueData|null */
    public function getBillingData(): ?array
    {
        return in_array($this->getType(), ['invoice.paid', 'invoice.created', 'subscription.renewed', 'subscription.payment_due', 'subscription.cancelled'], true)
            ? $this->getData() : null;
    }

    /**
     * Obtenir la référence de la transaction
     */
    public function getReferenceId(): ?string
    {
        return $this->data['data']['reference_id'] ?? $this->data['reference_id'] ?? null;
    }

    /**
     * Obtenir le statut
     */
    public function getStatus(): ?string
    {
        return $this->data['data']['status'] ?? $this->data['status'] ?? null;
    }

    /**
     * Vérifier si c'est un événement de succès
     */
    public function isSuccess(): bool
    {
        $type = $this->getType();
        $status = $this->getStatus();
        
        return str_contains($type, 'success') || $status === 'SUCCESS';
    }

    /**
     * Vérifier si c'est un événement d'échec
     */
    public function isFailed(): bool
    {
        $type = $this->getType();
        $status = $this->getStatus();
        
        return str_contains($type, 'failed') || $status === 'FAILED';
    }

    /**
     * Vérifier si c'est un paiement expiré
     */
    public function isExpired(): bool
    {
        $type = $this->getType();
        $status = $this->getStatus();

        return $type === 'payment.expired' || $status === 'EXPIRED';
    }

    /**
     * Référence de commande marchand (data.client_reference).
     */
    public function getClientReference(): ?string
    {
        $value = $this->data['data']['client_reference'] ?? $this->data['client_reference'] ?? null;
        return is_string($value) ? $value : null;
    }

    /**
     * Accès aux propriétés via la notation objet
     */
    public function __get(string $name): mixed
    {
        return $this->data[$name] ?? $this->data['data'][$name] ?? null;
    }

    /**
     * Convertir en array
     */
    public function toArray(): array
    {
        return $this->data;
    }
}
