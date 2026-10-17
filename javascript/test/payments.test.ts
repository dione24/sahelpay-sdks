import { afterEach, describe, expect, it, vi } from 'vitest';
import SahelPay from '../dist/index.mjs';

afterEach(() => vi.unstubAllGlobals());
describe('payment creation wire contract', () => {
  it('sends a stable idempotency header and returns the canonical payment id', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, data: { id: 'pi_qa', amount: 1000, currency: 'XOF', status: 'PENDING' } }) });
    vi.stubGlobal('fetch', fetch);
    const sdk = new SahelPay({ secretKey: 'sk_test_qa' });
    for (let retry = 0; retry < 2; retry++) {
      const result = await sdk.payments.create({ amount: 1000, provider: 'ORANGE_MONEY', customer_phone: '+22370000000', idempotency_key: 'order-qa' });
      expect(result.id).toBe('pi_qa');
    }
    expect(fetch.mock.calls.every(call => call[1].headers['X-Idempotency-Key'] === 'order-qa')).toBe(true);
  });
  it('generates an idempotency header for callers without an explicit reference', async () => {
    // Node 16 ESM has node:crypto but no global Web Crypto.
    vi.stubGlobal('crypto', undefined);
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, data: { id: 'pi_qa' } }) });
    vi.stubGlobal('fetch', fetch);
    await new SahelPay({ secretKey: 'sk_test_qa' }).payments.create({ amount: 1000, provider: 'ORANGE_MONEY', customer_phone: '+22370000000' });
    expect(fetch.mock.calls[0][1].headers['X-Idempotency-Key']).toMatch(/^sdk_/);
  });
});
describe('payment creation forwards every documented field', () => {
  it('sends client_reference, hosted checkout, urls and catalogue items', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, data: { id: 'pi_f', status: 'INITIATED', checkout_url: 'https://pay.sahelpay.ml/c/pi_f', client_reference: 'ORDER-F' } }) });
    vi.stubGlobal('fetch', fetch);
    const result = await new SahelPay({ secretKey: 'sk_test_qa' }).payments.create({
      amount: 2500, provider: 'ORANGE_MONEY', customer_phone: '+22370000000', idempotency_key: 'order-f',
      client_reference: 'ORDER-F', hosted_checkout: true, success_url: 'https://shop.test/ok', cancel_url: 'https://shop.test/ko',
      items: [{ product_id: 'prod_1', quantity: 2 }],
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      client_reference: 'ORDER-F', hosted_checkout: true, success_url: 'https://shop.test/ok', cancel_url: 'https://shop.test/ko',
      items: [{ product_id: 'prod_1', quantity: 2 }],
    });
    expect(result.checkout_url).toBe('https://pay.sahelpay.ml/c/pi_f');
    expect(result.client_reference).toBe('ORDER-F');
  });
});
describe('withdrawal creation wire contract', () => {
  it('sends phone_number, Orange Money and an idempotency key as the API requires', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify({ success: true, data: { id: 'wd_1' } }) });
    vi.stubGlobal('fetch', fetch);
    await new SahelPay({ secretKey: 'sk_test_qa' }).withdrawals.create({ amount: 50000, phone_number: '+22370000000' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ amount: 50000, phone_number: '+22370000000', provider: 'ORANGE_MONEY' });
    expect(fetch.mock.calls[0][1].headers['X-Idempotency-Key']).toMatch(/^sdk_/);
  });
});
