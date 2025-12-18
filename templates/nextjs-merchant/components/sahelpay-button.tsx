"use client";

import { useState } from "react";

interface SahelPayButtonProps {
  orderId: string;
  amount: number;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export function SahelPayButton({
  orderId,
  amount,
  customerPhone,
  customerName,
  customerEmail,
  description,
  className = "",
  disabled = false,
}: SahelPayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          order_id: orderId,
          customer_phone: customerPhone,
          customer_name: customerName,
          customer_email: customerEmail,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur de paiement");
      }

      // Rediriger vers le checkout SahelPay
      window.location.href = data.data.redirect_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handlePayment}
        disabled={disabled || isLoading}
        className={`
          px-6 py-3 rounded-lg font-semibold text-white
          bg-gradient-to-r from-green-600 to-green-500
          hover:from-green-700 hover:to-green-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${className}
        `}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Chargement...
          </span>
        ) : (
          <span>Payer {amount.toLocaleString("fr-FR")} FCFA</span>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
