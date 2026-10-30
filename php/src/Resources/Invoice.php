<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/** Billing invoices. Read pagination through Response::getRawData()['pagination']. */
class Invoice
{
    public function __construct(private Client $client) {}

    /** @param array{subtotal: float|int, total: float|int, due_date: string, lines: array, idempotency_key?: string} $data */
    public function create(array $data): Response
    {
        $key = $data['idempotency_key'] ?? null;
        unset($data['idempotency_key']);
        return $this->client->post('/billing/invoices', $data, $key ? ['X-Idempotency-Key' => $key] : []);
    }

    /** @param array{status?: string, customer_id?: string, subscription_id?: string, limit?: int, offset?: int} $options */
    public function all(array $options = []): Response
    {
        return $this->client->get('/billing/invoices', array_intersect_key($options,
            array_flip(['status', 'customer_id', 'subscription_id', 'limit', 'offset'])));
    }

    public function retrieve(string $id): Response
    {
        return $this->client->get('/billing/invoices/' . rawurlencode($id));
    }

    public function open(string $id): Response
    {
        return $this->client->patch('/billing/invoices/' . rawurlencode($id) . '/open');
    }

    public function void(string $id): Response
    {
        return $this->client->patch('/billing/invoices/' . rawurlencode($id) . '/void');
    }

    public function generatePaymentLink(string $id): Response
    {
        return $this->client->post('/billing/invoices/' . rawurlencode($id) . '/payment-link');
    }
}
