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
        return $this->client->get('/transactions', $options);
    }

    /**
     * Obtenir les détails d'une transaction
     */
    public function get(string $referenceId): Response
    {
        return $this->client->get("/transactions/{$referenceId}");
    }

    /**
     * Vérifier le statut d'une transaction
     */
    public function verify(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}/status");
    }
}
