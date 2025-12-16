<?php

declare(strict_types=1);

namespace SahelPay\Http;

/**
 * Wrapper pour la réponse API
 */
class Response
{
    private int $statusCode;
    private array $data;
    private array $headers;

    public function __construct(int $statusCode, array $data, array $headers = [])
    {
        $this->statusCode = $statusCode;
        $this->data = $data;
        $this->headers = $headers;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getData(): array
    {
        return $this->data['data'] ?? $this->data;
    }

    public function getRawData(): array
    {
        return $this->data;
    }

    public function getHeaders(): array
    {
        return $this->headers;
    }

    public function getHeader(string $name): ?string
    {
        return $this->headers[$name][0] ?? null;
    }

    public function isSuccessful(): bool
    {
        return $this->statusCode >= 200 && $this->statusCode < 300;
    }

    public function getMessage(): ?string
    {
        return $this->data['message'] ?? null;
    }

    /**
     * Accès aux propriétés via la notation objet
     */
    public function __get(string $name): mixed
    {
        return $this->getData()[$name] ?? null;
    }

    /**
     * Vérifier si une propriété existe
     */
    public function __isset(string $name): bool
    {
        return isset($this->getData()[$name]);
    }

    /**
     * Convertir en array
     */
    public function toArray(): array
    {
        return $this->getData();
    }

    /**
     * Convertir en JSON
     */
    public function toJson(): string
    {
        return json_encode($this->getData(), JSON_PRETTY_PRINT);
    }
}
