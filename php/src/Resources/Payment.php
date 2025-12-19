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
     *   client_reference?: string,
     *   callback_url?: string,
     *   return_url?: string,
     *   success_url?: string,
     *   cancel_url?: string,
     *   hosted_checkout?: bool,
     *   metadata?: array
     * } $data
     * 
     * @option hosted_checkout Si true (par défaut), redirige vers la page SahelPay.
     *                         Si false, redirige directement vers le provider.
     */
    public function initiate(array $data): Response
    {
        $this->validateRequired($data, ['amount', 'provider', 'customer_phone']);
        
        // Set default for hosted_checkout if not specified
        if (!isset($data['hosted_checkout'])) {
            $data['hosted_checkout'] = true;
        }
        
        // API core: POST /v1/payments
        return $this->client->post('/payments', $data);
    }

    /**
     * Rechercher un paiement par référence client (votre ID de commande)
     */
    public function search(string $clientReference): Response
    {
        return $this->client->get("/payments/search", [
            'client_reference' => $clientReference
        ]);
    }

    /**
     * Obtenir les détails financiers complets (ledger, frais, etc.)
     */
    public function details(string $id): Response
    {
        return $this->client->get("/payments/{$id}/details");
    }

    /**
     * Réconcilier manuellement un paiement
     */
    public function reconcile(string $id): Response
    {
        return $this->client->post("/payments/{$id}/reconcile");
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
        // API core: GET /v1/payments/history
        return $this->client->get('/payments/history', $options);
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