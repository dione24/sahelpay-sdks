<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les plans d'abonnement
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
        
        return $this->client->post('/plans', $data);
    }

    /**
     * Lister tous les plans
     */
    public function all(): Response
    {
        return $this->client->get('/plans');
    }

    /**
     * Récupérer un plan par ID
     */
    public function get(string $planId): Response
    {
        return $this->client->get("/plans/{$planId}");
    }

    /**
     * Désactiver un plan
     */
    public function deactivate(string $planId): Response
    {
        return $this->client->patch("/plans/{$planId}/deactivate", []);
    }

    /**
     * Supprimer un plan
     */
    public function delete(string $planId): Response
    {
        return $this->client->delete("/plans/{$planId}");
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
