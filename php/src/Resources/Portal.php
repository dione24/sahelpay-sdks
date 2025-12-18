<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour le Customer Portal (comme Stripe Billing Portal)
 * 
 * Permet à vos clients de gérer leurs abonnements, méthodes de paiement
 * et consulter leur historique de transactions.
 */
class Portal
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer une session Customer Portal
     *
     * @param array{
     *   customer_phone: string,
     *   customer_name?: string,
     *   customer_email?: string,
     *   return_url?: string
     * } $data
     * 
     * @return Response Contient id, url, customer_id, expires_at
     * 
     * @example
     * $session = $sahelpay->portal->createSession([
     *     'customer_phone' => '+22370000000',
     *     'return_url' => 'https://monapp.com/account'
     * ]);
     * // Redirigez le client vers $session->data['url']
     */
    public function createSession(array $data): Response
    {
        $this->validateRequired($data, ['customer_phone']);
        
        return $this->client->post('/portal/sessions', $data);
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