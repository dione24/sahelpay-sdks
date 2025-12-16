<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Config;

/**
 * Resource pour la validation des webhooks
 */
class Webhook
{
    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;
    }

    /**
     * Vérifier la signature d'un webhook
     */
    public function verify(string $payload, string $signature): bool
    {
        $secret = $this->config->getWebhookSecret();
        
        if (!$secret) {
            throw new \RuntimeException("Webhook secret non configuré");
        }

        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        
        return hash_equals($expectedSignature, $signature);
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
