<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les plans d'abonnement clients.
 *
 * Routes : /v1/billing/plans
 */
class Plan
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un nouveau plan d'abonnement
     * POST /v1/billing/plans
     *
     * @param array{
     *   name: string,
     *   amount: int,
     *   interval: string,
     *   description?: string
     * } $data
     */
    public function create(array $data): Response
    {
        $this->validateRequired($data, ['name', 'amount', 'interval']);

        return $this->client->post('/billing/plans', $data);
    }

    /**
     * Lister tous les plans
     * GET /v1/billing/plans
     */
    public function all(): Response
    {
        return $this->client->get('/billing/plans');
    }

    /**
     * Modifier un plan
     * PATCH /v1/billing/plans/:id
     *
     * @param array{name?: string, description?: string, amount?: int, is_active?: bool} $data
     */
    public function update(string $planId, array $data): Response
    {
        return $this->client->patch('/billing/plans/' . rawurlencode($planId), $data);
    }

    /**
     * Désactiver un plan
     */
    public function deactivate(string $planId): Response
    {
        return $this->update($planId, ['is_active' => false]);
    }

    /**
     * Supprimer un plan. S'il a déjà des abonnements, il est seulement désactivé.
     * DELETE /v1/billing/plans/:id
     */
    public function delete(string $planId): Response
    {
        return $this->client->delete('/billing/plans/' . rawurlencode($planId));
    }

    /**
     * Créer un abonnement INCOMPLETE et un lien de paiement.
     * POST /v1/billing/plans/:id/send-link
     */
    public function sendLink(string $planId, string $customerPhone): Response
    {
        return $this->client->post('/billing/plans/' . rawurlencode($planId) . '/send-link', [
            'customer_phone' => $customerPhone,
        ]);
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
