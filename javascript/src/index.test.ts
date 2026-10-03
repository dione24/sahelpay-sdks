import { afterEach, describe, expect, it, vi } from 'vitest';
import SahelPay from './index';
import SahelPayMerchant from './merchant';

describe('sandbox defaults', () => {
  it('uses the live API host for logical sandbox mode', () => {
    const sdk = new SahelPay({
      secretKey: 'sk_test_123',
      environment: 'sandbox',
    });

    expect((sdk as any).client.baseUrl).toBe('https://api.sahelpay.ml');
  });

  it('uses the live API host for merchant test keys', () => {
    const merchant = new SahelPayMerchant({
      secretKey: 'sk_test_123',
    });

    expect((merchant as any).baseUrl).toBe('https://api.sahelpay.ml');
  });
});

describe('payment creation wire contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (data: Record<string, unknown>) => {
    const payload = { success: true, data };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('always sends the idempotency header the API requires', async () => {
    const fetch = stubFetch({ id: 'pi_1', status: 'INITIATED' });
    await new SahelPay({ secretKey: 'sk_test_123' }).payments.create({ amount: 1000, customer_phone: '+22370000000' });
    expect(fetch.mock.calls[0][1].headers['X-Idempotency-Key']).toMatch(/^sdk_/);
  });

  it('keeps an explicit idempotency key and forwards catalogue items and checkout_url', async () => {
    const fetch = stubFetch({ id: 'pi_2', status: 'INITIATED', checkout_url: 'https://pay.sahelpay.ml/c/pi_2' });
    const payment = await new SahelPay({ secretKey: 'sk_test_123' }).payments.create({
      amount: 2500,
      customer_phone: '+22370000000',
      idempotency_key: 'order-2',
      items: [{ product_id: 'prod_1', quantity: 2 }],
    });
    expect(fetch.mock.calls[0][1].headers['X-Idempotency-Key']).toBe('order-2');
    expect(JSON.parse(fetch.mock.calls[0][1].body).items).toEqual([{ product_id: 'prod_1', quantity: 2 }]);
    expect(payment.checkout_url).toBe('https://pay.sahelpay.ml/c/pi_2');
  });
});

describe('billing, withdrawals and refunds wire contracts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (data: unknown = {}) => {
    const payload = { success: true, data };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  const sdk = () => new SahelPay({ secretKey: 'sk_test_123' });

  const lastCall = (fetch: ReturnType<typeof stubFetch>) => {
    const [url, init] = fetch.mock.calls[0];
    return {
      url: url as string,
      method: init.method as string,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    };
  };

  it('plans.create posts to /v1/billing/plans', async () => {
    const fetch = stubFetch({ id: 'plan_1', name: 'Premium', amount: 10000, interval: 'MONTHLY' });
    await sdk().plans.create({ name: 'Premium', amount: 10000, interval: 'MONTHLY' });
    const call = lastCall(fetch);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/billing/plans');
    expect(call.body).toEqual({ name: 'Premium', amount: 10000, interval: 'MONTHLY' });
  });

  it('subscriptions.createWithPayment posts to /v1/billing/subscriptions/with-payment', async () => {
    const fetch = stubFetch({ subscription: { id: 'sub_1' }, payment_link: { url: 'https://pay.sahelpay.ml/x' } });
    await sdk().subscriptions.createWithPayment({
      plan_id: 'plan_1',
      customer_phone: '+22370000000',
    });
    const call = lastCall(fetch);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/billing/subscriptions/with-payment');
    expect(call.body).toEqual({ plan_id: 'plan_1', customer_phone: '+22370000000' });
  });

  it('customers.list hits GET /v1/billing/customers with search', async () => {
    const fetch = stubFetch({ customers: [], pagination: { page: 1 } });
    await sdk().customers.list({ search: '7012', page: 1, limit: 20 });
    const call = lastCall(fetch);
    expect(call.method).toBe('GET');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/billing/customers?search=7012&page=1&limit=20');
  });

  it('portal.createSession posts to /v1/portal/sessions', async () => {
    const fetch = stubFetch({ id: 'sess_1', url: 'https://pay.sahelpay.ml/portal/x' });
    await sdk().portal.createSession({ customer_phone: '+22370000000' });
    const call = lastCall(fetch);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/portal/sessions');
    expect(call.body).toEqual({ customer_phone: '+22370000000' });
  });

  it('withdrawals.create sends phone_number, ORANGE_MONEY and X-Idempotency-Key', async () => {
    const fetch = stubFetch({ id: 'wd_1' });
    await sdk().withdrawals.create({
      amount: 50000,
      phone_number: '+22370000000',
      idempotency_key: 'wd-1',
    });
    const call = lastCall(fetch);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/withdrawals');
    expect(call.body).toEqual({
      amount: 50000,
      phone_number: '+22370000000',
      provider: 'ORANGE_MONEY',
    });
    expect(call.headers['X-Idempotency-Key']).toBe('wd-1');
  });

  it('withdrawals.quote hits GET /v1/withdrawals/quote', async () => {
    const fetch = stubFetch({ amount: 50000, fee: 500 });
    await sdk().withdrawals.quote(50000);
    const call = lastCall(fetch);
    expect(call.method).toBe('GET');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/withdrawals/quote?amount=50000');
  });

  it('refunds.create posts to /v1/refunds with idempotency and has no list helper', async () => {
    const fetch = stubFetch({ id: 'rf_1' });
    const client = sdk();
    await client.refunds.create({
      payment_id: 'pi_1',
      amount: 1000,
      idempotency_key: 'rf-1',
    });
    const call = lastCall(fetch);
    expect(call.method).toBe('POST');
    expect(call.url).toBe('https://api.sahelpay.ml/v1/refunds');
    expect(call.body).toEqual({ payment_id: 'pi_1', amount: 1000 });
    expect(call.headers['X-Idempotency-Key']).toBe('rf-1');
    expect((client.refunds as { list?: unknown }).list).toBeUndefined();
  });
});

describe('capabilities', () => {
  it('exposes Orange Money only and disables payouts', async () => {
    const { CAPABILITIES, hasCapability } = await import('./capabilities');
    expect(Object.keys(CAPABILITIES)).toEqual(['ORANGE_MONEY']);
    expect(hasCapability('ORANGE_MONEY', 'payments')).toBe(true);
    expect(hasCapability('ORANGE_MONEY', 'payouts')).toBe(false);
    expect(hasCapability('ORANGE_MONEY', 'withdrawals')).toBe(true);
  });
});
