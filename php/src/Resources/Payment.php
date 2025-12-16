<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les paiements Mobile Money
 */
class Payment
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Initier un paiement Mobile Money
     *
     * @param array{
     *   amount: int,
     *   provider: string,
     *   customer_phone: string,
     *   customer_name?: string,
     *   customer_email?: string,
     *   description?: string,
     *   callback_url?: string,
     *   return_url?: string,
     *   metadata?: array
     * } $data
     */
    public function initiate(array $data): Response
    {
        $this->validateRequired($data, ['amount', 'provider', 'customer_phone']);
        
        return $this->client->post('/payments/initiate', $data);
    }

    /**
     * Vérifier le statut d'un paiement
     */
    public function verify(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}/status");
    }

    /**
     * Obtenir les détails d'un paiement
     */
    public function get(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}");
    }

    /**
     * Lister les paiements
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
     * Valider les champs requis
     */
    private function validateRequired(array $data, array $required): void
    {
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw new \InvalidArgumentException("Le champ '{$field}' est requis");
            }
        }
    }
}
