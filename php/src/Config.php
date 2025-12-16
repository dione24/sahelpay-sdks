<?php

declare(strict_types=1);

namespace SahelPay;

/**
 * Configuration pour le SDK SahelPay
 */
class Config
{
    public const VERSION = '1.0.0';
    public const DEFAULT_BASE_URL = 'https://api.sahelpay.ml';
    public const SANDBOX_BASE_URL = 'https://sandbox.sahelpay.ml';

    private string $secretKey;
    private string $publicKey;
    private string $baseUrl;
    private bool $sandbox;
    private ?string $webhookSecret;
    private int $timeout;

    public function __construct(
        string $secretKey,
        string $publicKey,
        ?string $webhookSecret = null,
        bool $sandbox = false,
        int $timeout = 30
    ) {
        $this->secretKey = $secretKey;
        $this->publicKey = $publicKey;
        $this->webhookSecret = $webhookSecret;
        $this->sandbox = $sandbox;
        $this->timeout = $timeout;
        $this->baseUrl = $sandbox ? self::SANDBOX_BASE_URL : self::DEFAULT_BASE_URL;
    }

    public function getSecretKey(): string
    {
        return $this->secretKey;
    }

    public function getPublicKey(): string
    {
        return $this->publicKey;
    }

    public function getWebhookSecret(): ?string
    {
        return $this->webhookSecret;
    }

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
    }

    public function setBaseUrl(string $url): self
    {
        $this->baseUrl = rtrim($url, '/');
        return $this;
    }

    public function isSandbox(): bool
    {
        return $this->sandbox;
    }

    public function getTimeout(): int
    {
        return $this->timeout;
    }

    public function setTimeout(int $timeout): self
    {
        $this->timeout = $timeout;
        return $this;
    }
}
