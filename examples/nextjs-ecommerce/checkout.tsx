/**
 * Exemple d'intégration SahelPay dans une boutique Next.js
 *
 * Ce composant montre comment intégrer le checkout SahelPay
 * dans une application e-commerce.
 */

"use client";

import { useState } from "react";
import Image from "next/image";

// Logos des providers
const providers = [
  {
    id: "ORANGE_MONEY",
    name: "Orange Money",
    logo: "/providers/orange-money.png",
  },
  { id: "WAVE", name: "Wave", logo: "/providers/wave.png" },
  { id: "MOOV", name: "Moov Money", logo: "/providers/moov.png" },
];

interface CheckoutProps {
  orderId: string;
  amount: number;
  currency?: string;
  onSuccess?: (payment: any) => void;
  onError?: (error: any) => void;
}

export function SahelPayCheckout({
  orderId,
  amount,
  currency = "XOF",
  onSuccess,
  onError,
}: CheckoutProps) {
  const [selectedProvider, setSelectedProvider] = useState("ORANGE_MONEY");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          amount,
          currency,
          provider: selectedProvider,
          phone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du paiement");
      }

      setPayment(data.payment);
      onSuccess?.(data.payment);
    } catch (err: any) {
      setError(err.message);
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  // Afficher les instructions après création du paiement
  if (payment) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Paiement initié</h2>
          <p className="text-gray-500 mt-2">
            Référence: {payment.reference_id}
          </p>
        </div>

        {payment.ussd_code && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-orange-800 mb-2">
              Composez ce code sur votre téléphone :
            </p>
            <p className="text-2xl font-mono font-bold text-orange-600 text-center">
              {payment.ussd_code}
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            📱 Vous allez recevoir une notification sur votre téléphone.
            Confirmez le paiement pour finaliser votre commande.
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Montant:{" "}
            <span className="font-bold">
              {amount.toLocaleString()} {currency}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Paiement Mobile Money
      </h2>

      <form onSubmit={handleSubmit}>
        {/* Sélection du provider */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Choisissez votre méthode de paiement
          </label>
          <div className="grid grid-cols-3 gap-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                className={`
                  p-4 border-2 rounded-lg flex flex-col items-center transition-all
                  ${
                    selectedProvider === provider.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }
                `}
              >
                <Image
                  src={provider.logo}
                  alt={provider.name}
                  width={40}
                  height={40}
                  className="mb-2"
                />
                <span className="text-xs text-gray-600">{provider.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Numéro de téléphone */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Numéro de téléphone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+223 70 00 00 00"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Le numéro associé à votre compte{" "}
            {providers.find((p) => p.id === selectedProvider)?.name}
          </p>
        </div>

        {/* Récapitulatif */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total à payer</span>
            <span className="text-2xl font-bold text-gray-900">
              {amount.toLocaleString()} {currency}
            </span>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Bouton de paiement */}
        <button
          type="submit"
          disabled={loading || !phone}
          className={`
            w-full py-4 rounded-lg font-semibold text-white transition-all
            ${
              loading || !phone
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Traitement...
            </span>
          ) : (
            `Payer ${amount.toLocaleString()} ${currency}`
          )}
        </button>

        {/* Sécurité */}
        <p className="text-xs text-gray-500 text-center mt-4">
          🔒 Paiement sécurisé par SahelPay
        </p>
      </form>
    </div>
  );
}

// API Route (pages/api/checkout.ts ou app/api/checkout/route.ts)
export const checkoutApiHandler = `
import SahelPay from '@sahelpay/sdk';
import type { NextApiRequest, NextApiResponse } from 'next';

const sahelpay = new SahelPay({
  secretKey: process.env.SAHELPAY_SECRET_KEY!,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { order_id, amount, currency, provider, phone } = req.body;

  try {
    const payment = await sahelpay.payments.create({
      amount,
      currency,
      provider,
      customer_phone: phone,
      description: \`Commande #\${order_id}\`,
      metadata: { order_id },
      return_url: \`\${process.env.NEXT_PUBLIC_URL}/orders/\${order_id}/success\`,
      callback_url: \`\${process.env.NEXT_PUBLIC_URL}/api/webhook\`,
    });

    // Sauvegarder la référence dans votre base de données
    // await db.order.update({ where: { id: order_id }, data: { payment_ref: payment.reference_id } });

    res.json({ payment });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
`;
