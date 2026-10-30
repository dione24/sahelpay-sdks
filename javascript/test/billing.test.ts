import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SahelPay from '../dist/index.mjs';

const fixtures = JSON.parse(readFileSync(new URL('../../test-vectors/billing/responses.json', import.meta.url), 'utf8'));
afterEach(() => vi.unstubAllGlobals());
function setup(response: unknown) {
  const fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(response) });
  vi.stubGlobal('fetch', fetch);
  return { client: new SahelPay({ secretKey: 'sk_test_PLACEHOLDER' }), fetch };
}
function request(fetch: ReturnType<typeof vi.fn>) {
  const [url, options] = fetch.mock.calls[0];
  return { url: new URL(url), ...options, body: options.body ? JSON.parse(options.body) : undefined };
}
describe('Billing response fixtures and HTTP contract', () => {
  it('creates quarterly/yearly plans and strips SDK idempotency from JSON', async () => {
    const { client, fetch } = setup(fixtures.plan);
    expect(await client.plans.create({ name: 'Premium', amount: 4000, interval: 'QUARTERLY', idempotency_key: 'fixture-plan' })).toEqual(fixtures.plan.data);
    expect(request(fetch)).toMatchObject({ method: 'POST', headers: { 'X-Idempotency-Key': 'fixture-plan' }, body: { interval: 'QUARTERLY' } });
    expect(request(fetch).body.idempotency_key).toBeUndefined();
  });
  it.each(['customer_id','customer_external_ref','customer_email'])('accepts %s without a phone', async key => {
    const { client, fetch } = setup(fixtures.subscription);
    const result = await client.subscriptions.create({ plan_id: 'plan_fixture', [key]: 'fixture', trial_end: '2026-11-30T00:00:00.000Z', idempotency_key: 'fixture-create' });
    expect(result).toEqual(fixtures.subscription.data);
    expect(request(fetch).body.customer_phone).toBeUndefined();
    expect(request(fetch).body.trial_end).toBe(result.trial_end);
    expect(request(fetch).headers['X-Idempotency-Key']).toBe('fixture-create');
  });
  it.each(['trial_checkout','paid_checkout_replay'])('preserves nullable checkout fields: %s', async name => {
    const { client, fetch } = setup(fixtures[name]);
    expect(await client.subscriptions.createWithPayment({ plan_id: 'plan_fixture', customer_external_ref: 'fixture_user', external_ref: 'checkout_fixture', trial_end: '2026-11-30T00:00:00.000Z', idempotency_key: 'fixture-checkout' })).toEqual(fixtures[name].data);
    expect(request(fetch).url.pathname).toBe('/v1/billing/subscriptions/with-payment');
    expect(request(fetch).body.idempotency_key).toBeUndefined();
  });
  it('retrieves the canonical snapshot and safely encodes identifiers', async () => {
    const { client, fetch } = setup(fixtures.snapshot);
    expect(await client.subscriptions.retrieve('sub/fixture')).toEqual(fixtures.snapshot.data);
    expect(request(fetch).url.pathname).toBe('/v1/billing/subscriptions/sub%2Ffixture');
  });
  it('imports a period with stable external reference', async () => {
    const { client, fetch } = setup(fixtures.snapshot);
    const data = fixtures.snapshot.data;
    expect(await client.subscriptions.import({ plan_id: data.plan_id, external_ref: data.external_ref, customer_external_ref: 'fixture_user', current_period_start: data.current_period_start, current_period_end: data.current_period_end, idempotency_key: 'fixture-import' })).toEqual(data);
    expect(request(fetch).url.pathname).toBe('/v1/billing/subscriptions/import');
    expect(request(fetch).body.idempotency_key).toBeUndefined();
  });
  it('preserves all customer pagination and null phone fields', async () => {
    const { client, fetch } = setup(fixtures.customers);
    expect(await client.customers.list({ search: 'external&ref', page: 2, limit: 1 })).toEqual(fixtures.customers.data);
    expect(Object.fromEntries(request(fetch).url.searchParams)).toEqual({ search:'external&ref', page:'2', limit:'1' });
  });
  it('preserves invoice pagination outside data, including offset zero', async () => {
    const { client, fetch } = setup(fixtures.invoices);
    expect(await client.invoices.list({ status: 'OPEN', limit: 1, offset: 0 })).toEqual({ invoices: fixtures.invoices.data, pagination: fixtures.invoices.pagination });
    expect(Object.fromEntries(request(fetch).url.searchParams)).toEqual({status:'OPEN',limit:'1',offset:'0'});
  });
  it.each([['retrieve','GET',''],['open','PATCH','/open'],['void','PATCH','/void'],['generatePaymentLink','POST','/payment-link']] as const)('invoice %s route', async (method, verb, suffix) => {
    const { client, fetch } = setup(fixtures.invoice);
    await client.invoices[method]('inv/fixture');
    expect(request(fetch).method).toBe(verb);
    expect(request(fetch).url.pathname).toBe(`/v1/billing/invoices/inv%2Ffixture${suffix}`);
  });
  it('creates invoices with a header idempotency key', async () => {
    const { client, fetch } = setup(fixtures.invoice);
    expect(await client.invoices.create({ subtotal:4000,total:4000,due_date:'2026-11-30T00:00:00Z',lines:[{description:'Premium',amount:4000,unit_price:4000}],idempotency_key:'fixture-invoice' })).toEqual(fixtures.invoice.data);
    expect(request(fetch).body.idempotency_key).toBeUndefined();
    expect(request(fetch).headers['X-Idempotency-Key']).toBe('fixture-invoice');
  });
  it('cancels with DELETE and preserves success envelope', async () => {
    const { client, fetch } = setup(fixtures.cancel);
    expect(await client.subscriptions.cancel('sub_fixture')).toEqual({success:true});
    expect(request(fetch)).toMatchObject({method:'DELETE'});
  });
  it.each(fixtures.events)('verifies signed Billing event $event, mode and payload without a phone', event => {
    const { client } = setup({});
    const raw = JSON.stringify(event);
    const timestamp = Math.floor(Date.now()/1000);
    const header = `t=${timestamp},v1=${createHmac('sha256','whsec_FIXTURE').update(`${timestamp}.${raw}`).digest('hex')}`;
    expect(client.webhooks.constructEvent(raw,header,'whsec_FIXTURE')).toEqual(event);
    expect(() => client.webhooks.constructEvent(raw+' ',header,'whsec_FIXTURE')).toThrow();
  });
  it('propagates API 409 codes for callers to handle', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:409,text:async()=>JSON.stringify({success:false,error:{code:'IDEMPOTENCY_CONFLICT',message:'Conflict'}})}));
    const client=new SahelPay({secretKey:'sk_test_PLACEHOLDER'});
    await expect(client.subscriptions.create({plan_id:'plan_fixture',customer_external_ref:'fixture_user'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  });
});
