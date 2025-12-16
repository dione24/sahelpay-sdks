<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les transactions
 */
class Transaction
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Lister les transactions
     *
     * @param array{
     *   limit?: int,
     *   offset?: int,
     *   status?: string
     * } $options
     */
    public function all(array $options = []): Response
    {
        // API core: GET /v1/payments/history
        return $this->client->get('/payments/history', $options);
    }

    /**
     * Obtenir les détails d'une transaction
     */
    public function get(string $referenceId): Response
    {
        // API core: GET /v1/payments/:reference
        return $this->client->get("/payments/{$referenceId}");
    }

    /**
     * Vérifier le statut d'une transaction
     */
    public function verify(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}/status");
    }
}