import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Parité de signature avec le serveur SahelPay, sur les artefacts publiés
 * (dist/index.js en CommonJS ET dist/index.mjs en ESM) : mêmes vecteurs que
 * la suite jest du serveur, le CLI et les SDK PHP / Python.
 * Régression couverte : le build ESM levait « Dynamic require of "crypto" ».
 */
const here = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(join(here, '..', '..', 'test-vectors', 'webhook-signature.json'), 'utf8'));
const requireCjs = createRequire(import.meta.url);

type Vector = { name: string; secret: string; timestamp: number; raw_body: string; header: string };

async function loadBuilds() {
  const cjs = requireCjs('../dist/index.js');
  const esm = await import('../dist/index.mjs');
  return [
    ['cjs', cjs.default || cjs.SahelPay],
    ['esm', esm.default || esm.SahelPay],
  ] as const;
}

const NEVER_EXPIRES = 10 ** 12;

describe('webhooks.verifySignature — parité serveur', async () => {
  const builds = await loadBuilds();

  for (const [format, SahelPay] of builds) {
    const client = new SahelPay({ secretKey: 'sk_test_parity' });

    it(`${format} : accepte les vecteurs valides du serveur`, () => {
      for (const v of vectors.valid as Vector[]) {
        expect(client.webhooks.verifySignature(v.raw_body, v.header, v.secret, NEVER_EXPIRES), v.name).toBe(true);
      }
    });

    it(`${format} : refuse les vecteurs invalides`, () => {
      for (const v of vectors.invalid as Vector[]) {
        expect(client.webhooks.verifySignature(v.raw_body, v.header, v.secret, NEVER_EXPIRES), v.name).toBe(false);
      }
    });

    it(`${format} : refuse un horodatage hors tolérance (rejeu)`, () => {
      const v = (vectors.valid as Vector[])[0];
      expect(client.webhooks.verifySignature(v.raw_body, v.header, v.secret)).toBe(false);
    });

    it(`${format} : accepte une signature fraîche calculée comme le worker`, () => {
      const secret = 'whsec_fresh';
      const body = JSON.stringify({ id: 'evt_1', event: 'payment.success', data: { amount: 4000 } });
      const t = Math.floor(Date.now() / 1000);
      const header = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
      expect(client.webhooks.verifySignature(body, header, secret)).toBe(true);
      expect(client.webhooks.parseEvent(body, header, secret).event).toBe('payment.success');
      expect(() => client.webhooks.parseEvent(body, header, 'whsec_wrong')).toThrow('Invalid webhook signature');
    });
  }
});
