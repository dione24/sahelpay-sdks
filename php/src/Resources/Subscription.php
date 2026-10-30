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
     * Créer un abonnement INCOMPLETE sans paiement, ou un essai explicite.
     * POST /v1/billing/subscriptions
     *
     * @param array{
     *   plan_id: string,
     *   customer_phone?: string,
     *   customer_id?: string,
     *   customer_external_ref?: string,
     *   customer_email?: string,
     *   trial_end?: string,
     *   idempotency_key?: string,
     *   start_date?: string
     * } $data
     */
    public function create(array $data): Response
    {
        $this->validateRequired($data, ['plan_id']);

        return $this->write('/billing/subscriptions', $data);
    }

    /**
     * Créer un abonnement INCOMPLETE + facture + lien de paiement.
     * POST /v1/billing/subscriptions/with-payment
     *
     * @param array{
     *   plan_id: string,
     *   customer_phone?: string,
     *   customer_id?: string,
     *   customer_external_ref?: string,
     *   customer_email?: string,
     *   trial_end?: string,
     *   idempotency_key?: string,
     *   redirect_url?: string,
     *   metadata?: array
     * } $data
     */
    public function createWithPayment(array $data): Response
    {
        $this->validateRequired($data, ['plan_id']);

        return $this->write('/billing/subscriptions/with-payment', $data);
    }

    /**
     * Lister les abonnements
     * GET /v1/billing/subscriptions
     *
     * @param array{status?: string, take?: int, cursor?: string} $options
     */
    public function all(array $options = []): Response
    {
        $query = array_intersect_key($options, array_flip(['status', 'take', 'cursor']));

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

    /** Canonical period, identity and current invoice link. */
    public function retrieve(string $id): Response
    {
        return $this->client->get('/billing/subscriptions/' . rawurlencode($id));
    }

    /** Import an existing current period; application key + customer_external_ref required. */
    public function importPeriod(array $data): Response
    {
        $this->validateRequired($data, ['plan_id', 'external_ref', 'customer_external_ref', 'current_period_start', 'current_period_end']);
        return $this->write('/billing/subscriptions/import', $data);
    }

    private function write(string $path, array $data): Response
    {
        $key = $data['idempotency_key'] ?? null;
        unset($data['idempotency_key']);
        return $this->client->post($path, $data, $key !== null ? ['X-Idempotency-Key' => $key] : []);
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
