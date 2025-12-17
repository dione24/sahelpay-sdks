<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les liens de paiement
 */
class PaymentLink
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Créer un lien de paiement
     *
     * @param array{
     *   amount: int,
     *   title: string,
     *   description?: string,
     *   max_uses?: int,
     *   expires_at?: string,
     *   metadata?: array
     * } $data
     */
    public function create(array $data): Response
    {
        if (!isset($data['price']) && isset($data['amount'])) {
            $data['price'] = $data['amount'];
            unset($data['amount']);
        }

        $this->validateRequired($data, ['price', 'title']);
        
        return $this->client->post('/payment-links', $data);
    }
    public function deactivate(string $id): Response
    {
        return $this->client->patch("/payment-links/{$id}/deactivate", []);
    }
    public function activate(string $id): Response
    {
        return $this->client->patch("/payment-links/{$id}/activate", []);
    }

    /**
     * Obtenir un lien de paiement par son slug
     */
    public function get(string $slug): Response
    {
        return $this->client->get("/payment-links/{$slug}");
    }

    /**
     * Lister les liens de paiement
     */
    public function all(array $options = []): Response
    {
        return $this->client->get('/payment-links', $options);
    }

    /**
     * Obtenir le QR code d'un lien
     */
    public function qrCode(string $slug): Response
    {
        return $this->client->get("/payment-links/{$slug}/qr");
    }

    /**
     * Obtenir l'URL mlplète d'un lien
     */
    public function getUrl(string $slug): string
    {
        return "https://pay.sahelpay.ml/{$slug}";
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