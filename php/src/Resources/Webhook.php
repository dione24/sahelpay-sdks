<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Config;
use SahelPay\Exceptions\WebhookSignatureException;

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

    /**
     * Tolérance par défaut pour le timestamp (5 minutes)
     */
    private const DEFAULT_TOLERANCE = 300;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    /**
     * Vérifier la signature d'un webhook (format Stripe-like)
     * 
     * @param string $payload Le body brut de la requête
     * @param string $signatureHeader Le header X-SahelPay-Signature complet
     * @param int $tolerance Tolérance en secondes pour le timestamp (défaut: 300)
     * @return bool True si la signature est valide
     * @throws WebhookSignatureException Si le format est invalide ou la signature incorrecte
     */
    public function verify(string $payload, string $signatureHeader, int $tolerance = self::DEFAULT_TOLERANCE): bool
    {
        $secret = $this->config->getWebhookSecret();
        
        if (!$secret) {
            throw new \RuntimeException("Webhook secret non configuré");
        }

        // Parser le header de signature (format: t=...,v1=...)
        $parts = $this->parseSignatureHeader($signatureHeader);
        
        $timestamp = $parts['t'] ?? null;
        $signature = $parts['v1'] ?? null;

        if (!$timestamp || !$signature) {
            throw new WebhookSignatureException("Format de signature invalide. Attendu: t=<timestamp>,v1=<signature>");
        }

        // Protection contre les replay attacks
        $now = time();
        if (abs($now - intval($timestamp)) > $tolerance) {
            throw new WebhookSignatureException("Timestamp trop ancien, possible replay attack");
        }

        // Calculer la signature attendue
        $signaturePayload = $timestamp . '.' . $payload;
        $expectedSignature = hash_hmac('sha256', $signaturePayload, $secret);

        // Comparaison timing-safe
        if (!hash_equals($expectedSignature, $signature)) {
            throw new WebhookSignatureException("Signature invalide");
        }

        return true;
    }

    /**
     * Construire et vérifier un événement webhook
     * 
     * @param string $payload Le body brut de la requête
     * @param string $signatureHeader Le header X-SahelPay-Signature
     * @param int $tolerance Tolérance en secondes pour le timestamp
     * @return WebhookEvent L'événement vérifié
     * @throws WebhookSignatureException Si la signature est invalide
     */
    public function constructEvent(string $payload, string $signatureHeader, int $tolerance = self::DEFAULT_TOLERANCE): WebhookEvent
    {
        $this->verify($payload, $signatureHeader, $tolerance);
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