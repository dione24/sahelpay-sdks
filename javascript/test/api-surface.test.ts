import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SahelPay from '../dist/index.mjs';

/** Contrats hors réseau ajoutés en 1.1.0 : chaque appel vise une route réelle de l'API. */
afterEach(() => vi.unstubAllGlobals());

function stubFetch(data: unknown = { id: 'x', slug: 'abc' }) {
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, data }) });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const sdk = () => new SahelPay({ secretKey: 'sk_test_qa' });
const call = (fetch: ReturnType<typeof vi.fn>, i = 0) => ({
  url: new URL(fetch.mock.calls[i][0]),
  method: fetch.mock.calls[i][1].method,
  body: fetch.mock.calls[i][1].body ? JSON.parse(fetch.mock.calls[i][1].body) : undefined,
  headers: fetch.mock.calls[i][1].headers,
});

describe('payments.create', () => {
  it('sends description at the root, where the API reads it', async () => {
    const fetch = stubFetch({ id: 'pi_1' });
    await sdk().payments.create({ amount: 1000, customer_phone: '+22370000000', description: 'Commande 42' });
    const { body } = call(fetch);
    expect(body.description).toBe('Commande 42');
    expect(body.metadata.description).toBeUndefined();
  });

  it('accepts a hosted checkout without payer phone and omits an empty customer', async () => {
    const fetch = stubFetch({ id: 'pi_2', checkout_url: 'https://pay.sahelpay.africa/checkout/pi_2' });
    const payment = await sdk().payments.create({ amount: 1000, client_reference: 'ORDER-2' });
    const { body } = call(fetch);
    expect(body.customer).toBeUndefined();
    expect(body.hosted_checkout).toBe(true);
    expect(payment.client_reference).toBe('ORDER-2');
  });

  it('expires through POST /v1/payments/:id/expire', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, message: 'PaymentIntent expired' }) });
    vi.stubGlobal('fetch', fetch);
    const result = await sdk().payments.expire('pi_3');
    expect(call(fetch)).toMatchObject({ method: 'POST' });
    expect(call(fetch).url.pathname).toBe('/v1/payments/pi_3/expire');
    expect(result.success).toBe(true);
  });
});

describe('paymentLinks', () => {
  it('turns a legacy price into a FIXED link (the API defaults to OPEN)', async () => {
    const fetch = stubFetch();
    const link = await sdk().paymentLinks.create({ title: 'T-shirt', price: 5000 });
    expect(call(fetch).body).toMatchObject({ amount_mode: 'FIXED', price: 5000, title: 'T-shirt' });
    expect(link.url).toBe('https://pay.sahelpay.africa/abc');
  });

  it('keeps OPEN when no amount is given', async () => {
    const fetch = stubFetch();
    await sdk().paymentLinks.create({ name: 'Caisse', min_amount: 500 });
    expect(call(fetch).body.amount_mode).toBe('OPEN');
  });

  it('updates, deletes and reads by id on the real routes', async () => {
    const fetch = stubFetch();
    const client = sdk();
    await client.paymentLinks.update('pl_1', { name: 'Nouveau' });
    await client.paymentLinks.delete('pl_1');
    await client.paymentLinks.retrieveById('pl_1');
    expect([call(fetch, 0).method, call(fetch, 0).url.pathname]).toEqual(['PATCH', '/v1/payment-links/pl_1']);
    expect([call(fetch, 1).method, call(fetch, 1).url.pathname]).toEqual(['DELETE', '/v1/payment-links/pl_1']);
    expect(call(fetch, 2).url.pathname).toBe('/v1/payment-links/by-id/pl_1');
  });
});

describe('webhooks delivery API', () => {
  it('lists logs with filters, retries and reads events', async () => {
    const fetch = stubFetch([]);
    const client = sdk();
    await client.webhooks.listLogs({ status: 'FAILED', limit: 10 });
    await client.webhooks.retry('log_1');
    await client.webhooks.listEvents({ limit: 5 });
    expect(call(fetch, 0).url.pathname).toBe('/v1/webhooks/logs');
    expect(Object.fromEntries(call(fetch, 0).url.searchParams)).toEqual({ status: 'FAILED', limit: '10' });
    expect([call(fetch, 1).method, call(fetch, 1).url.pathname]).toEqual(['POST', '/v1/webhooks/logs/log_1/retry']);
    expect(call(fetch, 2).url.search).toBe('?limit=5');
  });

  it('rejects a bare body HMAC (no timestamp, no replay protection)', () => {
    const payload = '{"id":"evt_1","event":"payment.success"}';
    const legacy = createHmac('sha256', 'whsec_test').update(payload).digest('hex');
    expect(sdk().webhooks.verifySignature(payload, legacy, 'whsec_test')).toBe(false);
  });
});

describe('secureOrders', () => {
  it('creates with an idempotency header and confirms delivery with the buyer code', async () => {
    const fetch = stubFetch({ id: 'so_1' });
    const client = sdk();
    await client.secureOrders.create({ amount: 15000, description: 'Robe wax', customer_phone: '+22370000000', idempotency_key: 'order-9' });
    await client.secureOrders.confirmDelivery('so_1', '482913');
    expect(call(fetch, 0).url.pathname).toBe('/v1/secure-orders');
    expect(call(fetch, 0).headers['X-Idempotency-Key']).toBe('order-9');
    expect(call(fetch, 0).body.idempotency_key).toBeUndefined();
    expect(call(fetch, 1).url.pathname).toBe('/v1/secure-orders/so_1/confirm-delivery');
    expect(call(fetch, 1).body).toEqual({ code: '482913' });
  });
});
