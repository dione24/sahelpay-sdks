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
     * Créer un lien de paiement.
     *
     * Noms actuels : name, fixed_amount, success_redirect_url. Les anciens noms
     * (title, price ou amount, redirect_url) restent acceptés. Un montant sans
     * `amount_mode` crée un lien à prix fixe (FIXED) : l'API, elle, retombe sur
     * OPEN (montant libre) si le mode manque.
     *
     * @param array{
     *   name?: string,
     *   title?: string,
     *   description?: string,
     *   amount_mode?: 'FIXED'|'OPEN',
     *   fixed_amount?: int,
     *   price?: int,
     *   amount?: int,
     *   min_amount?: int,
     *   max_amount?: int,
     *   currency?: string,
     *   success_redirect_url?: string,
     *   redirect_url?: string,
     *   image_url?: string,
     *   expires_at?: string,
     *   max_uses?: int,
     *   product_id?: string
     * } $data
     */
    public function create(array $data): Response
    {
        if (!isset($data['fixed_amount'])) {
            $legacyAmount = $data['price'] ?? $data['amount'] ?? null;
            if ($legacyAmount !== null) {
                $data['fixed_amount'] = $legacyAmount;
            }
        }
        unset($data['amount']);

        if (empty($data['name']) && empty($data['title']) && empty($data['product_id'])) {
            throw new \InvalidArgumentException("Le champ 'name' est requis");
        }

        if (!isset($data['amount_mode'])) {
            $data['amount_mode'] = isset($data['fixed_amount']) ? 'FIXED' : 'OPEN';
        }

        return $this->client->post('/payment-links', $data);
    }

    /**
     * Récupérer un de vos liens par son id (authentifié).
     */
    public function retrieveById(string $id): Response
    {
        return $this->client->get('/payment-links/by-id/' . rawurlencode($id));
    }

    /**
     * Modifier un lien : name, description, is_active, min_amount, max_amount, success_redirect_url.
     */
    public function update(string $id, array $data): Response
    {
        return $this->client->patch('/payment-links/' . rawurlencode($id), $data);
    }

    /**
     * Supprimer (archiver) un lien : paiements et reçus conservés, l'URL publique répond 410.
     */
    public function delete(string $id): Response
    {
        return $this->client->delete('/payment-links/' . rawurlencode($id));
    }

    public function deactivate(string $id): Response
    {
        return $this->client->patch('/payment-links/' . rawurlencode($id) . '/deactivate', []);
    }

    public function activate(string $id): Response
    {
        return $this->client->patch('/payment-links/' . rawurlencode($id) . '/activate', []);
    }

    /**
     * Obtenir un lien de paiement par son slug
     */
    public function get(string $slug): Response
    {
        return $this->client->get('/payment-links/' . rawurlencode($slug));
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
        return $this->client->get('/payment-links/' . rawurlencode($slug) . '/qr');
    }

    /**
     * URL publique d'un lien (les anciennes URL pay.sahelpay.ml restent servies).
     */
    public function getUrl(string $slug): string
    {
        return 'https://pay.sahelpay.africa/' . rawurlencode($slug);
    }
}