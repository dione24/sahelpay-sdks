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
     * Vérifier la signature d'un webhook.
     *
     * Format actuel : X-SahelPay-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>.
     * Repli legacy : header = HMAC-SHA256 hex du body seul.
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

        $expectedLegacySignature = hash_hmac('sha256', $payload, $secret);
        return hash_equals($expectedLegacySignature, $signatureHeader);
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
