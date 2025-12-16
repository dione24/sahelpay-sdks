<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les payouts (envoi d'argent)
 */
class Payout
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un payout (envoyer de l'argent)
     *
     * @param array{
     *   amount: int,
     *   provider: string,
     *   recipient_phone: string,
     *   recipient_name?: string,
     *   description?: string,
     *   type?: string,
     *   metadata?: array,
     *   idempotency_key?: string
     * } $data
     */
    public function create(array $data): Response
    {
        $this->validateRequired($data, ['amount', 'provider', 'recipient_phone']);
        
        // Valider le provider
        $validProviders = ['ORANGE_MONEY', 'WAVE', 'MOOV'];
        if (!in_array($data['provider'], $validProviders)) {
            throw new \InvalidArgumentException(
                "Provider invalide. Utilisez: " . implode(', ', $validProviders)
            );
        }

        // Valider le montant
        if ($data['amount'] < 100) {
            throw new \InvalidArgumentException("Le montant minimum est de 100 FCFA");
        }
        if ($data['amount'] > 5000000) {
            throw new \InvalidArgumentException("Le montant maximum est de 5,000,000 FCFA");
        }

        return $this->client->post('/payouts', $data);
    }

    /**
     * Obtenir un payout par sa référence
     */
    public function get(string $reference): Response
    {
        return $this->client->get("/payouts/{$reference}");
    }

    /**
     * Lister les payouts
     *
     * @param array{
     *   page?: int,
     *   limit?: int,
     *   status?: string,
     *   type?: string
     * } $options
     */
    public function all(array $options = []): Response
    {
        return $this->client->get('/payouts', $options);
    }

    /**
     * Annuler un payout en attente
     */
    public function cancel(string $reference): Response
    {
        return $this->client->delete("/payouts/{$reference}");
    }

    /**
     * Obtenir les statistiques des payouts
     */
    public function stats(): Response
    {
        return $this->client->get('/payouts/stats');
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
