import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/webhooks/sahelpay
 *
 * Webhook handler pour les événements SahelPay.
 * C'est la SOURCE DE VÉRITÉ pour le statut des paiements.
 *
 * ⚠️ Ne JAMAIS marquer une commande comme "payée" sans ce webhook.
 *
 * La commande se retrouve via `data.client_reference` (votre `order_id`,
 * envoyé à la création du paiement). Les webhooks n'incluent pas
 * `metadata.app_order_id`.
 */

const SAHELPAY_WEBHOOK_SECRET = process.env.SAHELPAY_WEBHOOK_SECRET;

type PaymentEvent =
  | 'payment.success'
  | 'payment.failed'
  | 'payment.pending'
  | 'payment.expired'
  | 'payment.updated';

interface WebhookPayload {
  id?: string;
  event: PaymentEvent | (string & {});
  version?: string;
  data: {
    id: string;
    amount?: number;
    currency?: string;
    status?: string;
    provider?: string;
    provider_ref?: string;
    customer_phone?: string;
    client_reference?: string;
    metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
  };
  timestamp: string;
}

/**
 * Vérifie la signature HMAC-SHA256 du webhook (format Stripe-like)
 */
function verifySignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): { valid: boolean; error?: string } {
  try {
    const parts: Record<string, string> = {};
    signatureHeader.split(',').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) parts[key] = value;
    });

    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp && !signature && signatureHeader.length === 64) {
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const isValid = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
      return { valid: isValid };
    }

    if (!timestamp || !signature) {
      return { valid: false, error: 'Invalid signature format' };
    }

    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > toleranceSeconds) {
      return { valid: false, error: 'Timestamp too old' };
    }

    const signaturePayload = `${timestamp}.${payload}`;
    const expected = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    return { valid: isValid, error: isValid ? undefined : 'Invalid signature' };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-sahelpay-signature') || '';

    if (SAHELPAY_WEBHOOK_SECRET) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }

      const verification = verifySignature(rawBody, signature, SAHELPAY_WEBHOOK_SECRET);
      if (!verification.valid) {
        console.error('Invalid webhook signature:', verification.error);
        return NextResponse.json({ error: verification.error }, { status: 401 });
      }
    }

    const payload: WebhookPayload = JSON.parse(rawBody);
    const { event, data } = payload;
    const orderId = data.client_reference;

    console.log(`[SahelPay Webhook] Event: ${event}, Payment: ${data.id}, Order: ${orderId}`);

    if (event === 'webhook.test') {
      return NextResponse.json({ received: true });
    }

    if (typeof event === 'string' && event.startsWith('payment.') && !orderId) {
      // 400 ferait retenter SahelPay indéfiniment : loguer et accuser réception
      // si le paiement n'a pas de client_reference (lien, facture, etc.).
      console.warn('[SahelPay Webhook] payment event without client_reference', data.id);
      return NextResponse.json({ received: true, ignored: 'missing_client_reference' });
    }

    switch (event) {
      case 'payment.success':
        console.log(`✅ Payment success received for order ${orderId}`);
        // Marquer la commande orderId comme payée dans votre base.
        break;

      case 'payment.failed':
        console.log(`❌ Payment ${data.id} FAILED for order ${orderId}`);
        break;

      case 'payment.expired':
        console.log(`⏰ Payment ${data.id} EXPIRED for order ${orderId}`);
        break;

      case 'payment.pending':
      case 'payment.updated':
        console.log(`ℹ️ Payment ${data.id} ${event} for order ${orderId}`);
        break;

      default:
        // secure_order.*, invoice.*, subscription.* : ignorez ce que vous ne gérez pas.
        break;
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
