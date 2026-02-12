import { NextRequest, NextResponse } from 'next/server';

const SAHELPAY_API_URL = process.env.SAHELPAY_API_URL || 'https://api.sahelpay.ml';
const SAHELPAY_SECRET_KEY = process.env.SAHELPAY_SECRET_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!SAHELPAY_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Configuration paiement manquante' },
        { status: 500 }
      );
    }

    const paymentId = request.nextUrl.searchParams.get('id');
    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'id requis' },
        { status: 400 }
      );
    }

    const response = await fetch(`${SAHELPAY_API_URL}/v1/payments/${encodeURIComponent(paymentId)}/status`, {
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
