<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les abonnements
 */
class Subscription
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un nouvel abonnement
     *
     * @param array{
     *   plan_id: string,
     *   customer_phone: string,
     *   start_date?: string
     * } $data
     */
    public function create(array $data): Response
    {
        $this->validateRequired($data, ['plan_id', 'customer_phone']);
        
        return $this->client->post('/subscriptions', $data);
    }

    /**
     * Lister les abonnements
     *
     * @param array{
     *   plan_id?: string,
     *   status?: string,
     *   limit?: int
     * } $options
     */
    public function all(array $options = []): Response
    {
        return $this->client->get('/subscriptions', $options);
    }

    /**
     * Récupérer un abonnement par ID
     */
    public function get(string $subscriptionId): Response
    {
        return $this->client->get("/subscriptions/{$subscriptionId}");
    }

    /**
     * Annuler un abonnement
     */
    public function cancel(string $subscriptionId): Response
    {
        return $this->client->delete("/subscriptions/{$subscriptionId}");
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