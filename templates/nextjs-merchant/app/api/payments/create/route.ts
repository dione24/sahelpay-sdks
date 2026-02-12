import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payments/create
 * 
 * Crée un paiement SahelPay pour une commande.
 * 
 * ⚠️ La clé secrète SahelPay n'est JAMAIS exposée au client
 */

const SAHELPAY_API_URL = process.env.SAHELPAY_API_URL || 'https://api.sahelpay.ml';
const SAHELPAY_SECRET_KEY = process.env.SAHELPAY_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface CreatePaymentBody {
  amount: number;
  order_id: string;
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Vérifier la configuration
    if (!SAHELPAY_SECRET_KEY) {
      console.error('SAHELPAY_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Configuration paiement manquante' },
        { status: 500 }
      );
    }

    const body: CreatePaymentBody = await request.json();

    // Validation
    if (!body.amount || body.amount < 100) {
      return NextResponse.json(
        { error: 'Montant invalide (min: 100 FCFA)' },
        { status: 400 }
      );
    }

    if (!body.order_id) {
      return NextResponse.json(
        { error: 'order_id requis' },
        { status: 400 }
      );
    }

    if (!body.customer_phone) {
      return NextResponse.json(
        { error: 'customer_phone requis' },
        { status: 400 }
      );
    }

    // Clé d'idempotence basée sur l'order_id
    const idempotencyKey = `app-order-${body.order_id}`;

    // Appeler l'API SahelPay
    const response = await fetch(`${SAHELPAY_API_URL}/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SAHELPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        amount: body.amount,
        currency: 'XOF',
        payment_method: 'MOBILE_MONEY',
        country: 'ML',
        customer: {
          phone: body.customer_phone,
          name: body.customer_name,
          email: body.customer_email,
        },
        return_url: `${APP_URL}/checkout/return?order_id=${body.order_id}`,
        client_reference: body.order_id,
        metadata: {
          app_order_id: body.order_id,
          description: body.description,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('SahelPay API error:', data);
      return NextResponse.json(
        { error: data.error?.message || 'Erreur SahelPay' },
        { status: response.status }
      );
    }

    console.info('[SahelPay Template] Payment created', {
      order_id: body.order_id,
      payment_id: data.data.id,
      status: data.data.status,
    });

    return NextResponse.json({
      success: true,
      data: {
        payment_id: data.data.id,
        redirect_url: data.data.redirect_url,
        expires_at: data.data.expires_at,
      },
    });

  } catch (error) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
