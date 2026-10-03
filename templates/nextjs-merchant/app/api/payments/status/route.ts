import { NextRequest, NextResponse } from 'next/server';

const SAHELPAY_API_URL = process.env.SAHELPAY_API_URL || 'https://api.sahelpay.ml';
const SAHELPAY_SECRET_KEY = process.env.SAHELPAY_SECRET_KEY;

/**
 * GET /api/payments/status?client_reference=order_123
 * GET /api/payments/status?id=pi_xxx
 *
 * SahelPay ne rajoute pas `payment_intent_id` à return_url : passez votre
 * `order_id` dans return_url et recherchez via client_reference.
 */
export async function GET(request: NextRequest) {
  try {
    if (!SAHELPAY_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuration paiement manquante' },
        { status: 500 }
      );
    }

    const clientReference =
      request.nextUrl.searchParams.get('client_reference') ||
      request.nextUrl.searchParams.get('order_id');
    const paymentId = request.nextUrl.searchParams.get('id');

    if (!clientReference && !paymentId) {
      return NextResponse.json(
        { success: false, error: 'client_reference ou id requis' },
        { status: 400 }
      );
    }

    const path = clientReference
      ? `/v1/payments/search?client_reference=${encodeURIComponent(clientReference)}`
      : `/v1/payments/${encodeURIComponent(paymentId!)}/status`;

    const response = await fetch(`${SAHELPAY_API_URL}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SAHELPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.error?.message || 'Erreur SahelPay' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data: data.data });
  } catch (error) {
    console.error('Payment status error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur interne' },
      { status: 500 }
    );
  }
}
