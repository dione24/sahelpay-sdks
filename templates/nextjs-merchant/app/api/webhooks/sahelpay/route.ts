import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/webhooks/sahelpay
 * 
 * Webhook handler pour les événements SahelPay.
 * C'est la SOURCE DE VÉRITÉ pour le statut des paiements.
 * 
 * ⚠️ Ne JAMAIS marquer une commande comme "payée" sans ce webhook.
 */

const SAHELPAY_WEBHOOK_SECRET = process.env.SAHELPAY_WEBHOOK_SECRET;

interface WebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.cancelled' | 'payment.expired';
  version: string;
  data: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    provider?: string;
    provider_ref?: string;
    customer_phone?: string;
    metadata?: {
      app_order_id?: string;
      [key: string]: unknown;
    };
    created_at: string;
    updated_at: string;
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

    // Fallback: ancien format
    if (!timestamp && !signature && signatureHeader.length === 64) {
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const isValid = crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
      return { valid: isValid };
    }

    if (!timestamp || !signature) {
      return { valid: false, error: 'Invalid signature format' };
    }

    // Protection replay
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestampNum) > toleranceSeconds) {
      return { valid: false, error: 'Timestamp too old' };
    }

    // Vérifier signature
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

    // Vérifier la signature
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
    const orderId = data.metadata?.app_order_id;

    console.log(`[SahelPay Webhook] Event: ${event}, Payment: ${data.id}, Order: ${orderId}`);

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    // TODO: Vérifier l'idempotence dans votre DB
    // const existing = await db.payments.findUnique({ where: { transaction_id: data.id } });
    // if (existing?.status === 'success') {
    //   return NextResponse.json({ received: true, already_processed: true });
    // }

    // Traiter selon l'événement
    switch (event) {
      case 'payment.success':
        // TODO: Mettre à jour votre DB
        // await db.payments.update({ where: { transaction_id: data.id }, data: { status: 'success' } });
        // await db.orders.update({ where: { id: orderId }, data: { status: 'paid' } });
        console.log(`✅ Order ${orderId} marked as PAID`);
        break;

      case 'payment.failed':
        // await db.payments.update({ where: { transaction_id: data.id }, data: { status: 'failed' } });
        console.log(`❌ Payment ${data.id} FAILED`);
        break;

      case 'payment.cancelled':
        console.log(`🚫 Payment ${data.id} CANCELLED`);
        break;

      case 'payment.expired':
        console.log(`⏰ Payment ${data.id} EXPIRED`);
        break;
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
