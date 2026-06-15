import { describe, expect, it } from 'vitest';
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
