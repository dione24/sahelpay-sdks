<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les clients d'un marchand.
 *
 * Les clients sont créés automatiquement (abonnement, lien de plan, portail) :
 * il n'y a pas d'API de création, mise à jour ou suppression.
 *
 * Route : GET /v1/billing/customers
 */
class Customer
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Lister les clients
     * GET /v1/billing/customers
     *
     * @param array{search?: string, page?: int, limit?: int} $options
     */
    public function all(array $options = []): Response
    {
        $query = array_intersect_key($options, array_flip(['search', 'page', 'limit']));

        return $this->client->get('/billing/customers', $query);
    }

    /**
     * Alias de all().
     *
     * @param array{search?: string, page?: int, limit?: int} $options
     */
    public function list(array $options = []): Response
    {
        return $this->all($options);
    }
}
