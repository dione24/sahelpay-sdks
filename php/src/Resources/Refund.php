<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les remboursements
 */
class Refund
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un remboursement
     *
     * @param array{
     *   payment_id: string,
     *   amount: int,
     *   reason?: string,
     *   refund_fees?: bool
     * } $data
     */
    public function create(array $data): Response
    {
        return $this->client->post('/refunds', $data);
    }

    /**
     * Lister les remboursements
     *
     * @param array{
     *   limit?: int,
     *   offset?: int
     * } $options
     */
    public function all(array $options = []): Response
    {
        return $this->client->get('/refunds', $options);
    }
}
