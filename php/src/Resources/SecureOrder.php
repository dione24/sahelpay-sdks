<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Paiement sécurisé : les fonds restent en séquestre jusqu'à la confirmation
 * de livraison par le code à 6 chiffres de l'acheteur. Fonction activée par
 * marchand : sans activation, l'API répond 404 SECURE_ORDERS_DISABLED.
 */
class SecureOrder
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * @param array{
     *   amount: int,
     *   description: string,
     *   customer_phone: string,
     *   customer_name?: string,
     *   delivery_deadline_hours?: int,
     *   client_reference?: string,
     *   idempotency_key?: string
     * } $data
     */
    public function create(array $data): Response
    {
        foreach (['amount', 'description', 'customer_phone'] as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                throw new \InvalidArgumentException("Le champ '{$field}' est requis");
            }
        }

        $headers = [
            'X-Idempotency-Key' => !empty($data['idempotency_key'])
                ? (string) $data['idempotency_key']
                : 'sdk_' . bin2hex(random_bytes(16)),
        ];
        unset($data['idempotency_key']);

        return $this->client->post('/secure-orders', $data, $headers);
    }

    /**
     * @param array{status?: string, search?: string, page?: int, limit?: int} $query
     */
    public function all(array $query = []): Response
    {
        return $this->client->get('/secure-orders', $query);
    }

    public function get(string $id): Response
    {
        return $this->client->get('/secure-orders/' . rawurlencode($id));
    }

    /**
     * Annuler une commande avant paiement.
     */
    public function cancel(string $id, ?string $reason = null): Response
    {
        return $this->client->post('/secure-orders/' . rawurlencode($id) . '/cancel', $reason !== null ? ['reason' => $reason] : []);
    }

    /**
     * Confirmer la livraison avec le code communiqué par l'acheteur : libère les fonds.
     */
    public function confirmDelivery(string $id, string $code): Response
    {
        return $this->client->post('/secure-orders/' . rawurlencode($id) . '/confirm-delivery', ['code' => $code]);
    }
}
