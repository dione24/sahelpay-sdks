<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les remboursements.
 *
 * En production, POST /v1/refunds répond 503 (REFUNDS_UNAVAILABLE).
 * GET /v1/refunds n'existe pas.
 */
class Refund
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un remboursement.
     *
     * En production : 503. `X-Idempotency-Key` est obligatoire (généré si absent).
     *
     * @param array{
     *   payment_id: string,
     *   amount: int,
     *   reason?: string,
     *   refund_fees?: bool,
     *   idempotency_key?: string
     * } $data
     */
    public function create(array $data): Response
    {
        if (empty($data['payment_id'])) {
            throw new \InvalidArgumentException("Le champ 'payment_id' est requis");
        }
        if (!isset($data['amount'])) {
            throw new \InvalidArgumentException("Le champ 'amount' est requis");
        }

        $headers = [
            'X-Idempotency-Key' => !empty($data['idempotency_key'])
                ? (string) $data['idempotency_key']
                : 'sdk_' . bin2hex(random_bytes(16)),
        ];
        unset($data['idempotency_key']);

        return $this->client->post('/refunds', $data, $headers);
    }
}
