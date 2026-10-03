<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les abonnements clients.
 *
 * Routes : /v1/billing/subscriptions
 */
class Subscription
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un abonnement ACTIVE (sans premier paiement).
     * POST /v1/billing/subscriptions
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

        return $this->client->post('/billing/subscriptions', $data);
    }

    /**
     * Créer un abonnement INCOMPLETE + facture + lien de paiement.
     * POST /v1/billing/subscriptions/with-payment
     *
     * @param array{
     *   plan_id: string,
     *   customer_phone: string,
     *   redirect_url?: string,
     *   metadata?: array
     * } $data
     */
    public function createWithPayment(array $data): Response
    {
        $this->validateRequired($data, ['plan_id', 'customer_phone']);

        return $this->client->post('/billing/subscriptions/with-payment', $data);
    }

    /**
     * Lister les abonnements
     * GET /v1/billing/subscriptions
     *
     * @param array{status?: string} $options
     */
    public function all(array $options = []): Response
    {
        $query = array_intersect_key($options, array_flip(['status']));

        return $this->client->get('/billing/subscriptions', $query);
    }

    /**
     * Annuler un abonnement
     * DELETE /v1/billing/subscriptions/:id
     */
    public function cancel(string $subscriptionId): Response
    {
        return $this->client->delete('/billing/subscriptions/' . rawurlencode($subscriptionId));
    }

    private function validateRequired(array $data, array $required): void
    {
        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                throw new \InvalidArgumentException("Le champ '{$field}' est requis");
            }
        }
    }
}
