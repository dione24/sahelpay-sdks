"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Status =
  | "loading"
  | "SUCCESS"
  | "PENDING"
  | "FAILED"
  | "EXPIRED"
  | "error";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const paymentId =
    searchParams.get("payment_intent_id") || searchParams.get("id");

  useEffect(() => {
    if (!paymentId) {
      setStatus("error");
      return;
    }
    checkStatus();
  }, [paymentId]);

  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/payments/status?id=${paymentId}`);
      const data = await res.json();

      if (data.success) {
        setStatus(data.data.status);
        // Si PENDING, re-vérifier dans 3s
        if (data.data.status === "PENDING") {
          setTimeout(checkStatus, 3000);
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <h1 className="text-xl font-bold">Vérification en cours...</h1>
          </>
        )}

        {status === "SUCCESS" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-green-700">
              Paiement confirmé !
            </h1>
            <p className="text-gray-600 mt-2">
              Votre paiement a été effectué avec succès.
            </p>
            <Link
              href="/orders"
              className="mt-6 inline-block px-6 py-2 bg-green-600 text-white rounded-lg"
            >
              Voir mes commandes
            </Link>
          </>
        )}

        {status === "PENDING" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-xl font-bold text-yellow-700">
              Paiement en cours...
            </h1>
            <p className="text-gray-600 mt-2">
              Veuillez patienter quelques instants.
            </p>
          </>
        )}

        {status === "FAILED" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">✗</span>
            </div>
            <h1 className="text-xl font-bold text-red-700">Paiement échoué</h1>
            <p className="text-gray-600 mt-2">
              Le paiement n&apos;a pas pu être effectué.
            </p>
            <Link
              href="/checkout"
              className="mt-6 inline-block px-6 py-2 bg-red-600 text-white rounded-lg"
            >
              Réessayer
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">⚠</span>
            </div>
            <h1 className="text-xl font-bold text-gray-700">Erreur</h1>
            <p className="text-gray-600 mt-2">
              Impossible de vérifier le statut.
            </p>
            <button
              onClick={checkStatus}
              className="mt-6 px-6 py-2 bg-gray-600 text-white rounded-lg"
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Chargement...
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
