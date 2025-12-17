<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les clients
 */
class Customer
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un nouveau client
     *
     * @param array{
     *   phone: string,
     *   name?: string,
     *   email?: string,
     *   metadata?: array
     * } $data
     */
    public function create(array $data): Response
    {
        $this->validateRequired($data, ['phone']);
        
        return $this->client->post('/customers', $data);
    }

    /**
     * Lister les clients
     *
     * @param array{
     *   limit?: int,
     *   offset?: int
     * } $options
     */
    public function all(array $options = []): Response
    {
        return $this->client->get('/customers', $options);
    }

    /**
     * Récupérer un client par ID
     */
    public function get(string $customerId): Response
    {
        return $this->client->get("/customers/{$customerId}");
    }

    /**
     * Mettre à jour un client
     *
     * @param array{
     *   name?: string,
     *   email?: string,
     *   metadata?: array
     * } $data
     */
    public function update(string $customerId, array $data): Response
    {
        return $this->client->patch("/customers/{$customerId}", $data);
    }

    /**
     * Supprimer un client
     */
    public function delete(string $customerId): Response
    {
        return $this->client->delete("/customers/{$customerId}");
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