/**
 * SahelPay SDK – Capability Matrix
 *
 * Orange Money (Mali) est le seul rail de paiement intégré.
 * Les payouts automatiques sont refusés par la plateforme : utilisez
 * `withdrawals.create` pour un retrait manuel vers Orange Money.
 */

export type PaymentMethod = "ORANGE_MONEY";

/** @deprecated Utilisez PaymentMethod à la place */
export type Provider = PaymentMethod;

export type Capability =
  | "payments"
  | "payment_links"
  | "qr_code"
  | "payouts"
  | "withdrawals"
  | "opr"
  | "splits"
  | "customer_portal";

export interface ProviderCapabilities {
  payments: boolean;
  payment_links: boolean;
  qr_code: boolean;
  payouts: boolean;
  withdrawals: boolean;
  opr: boolean;
  splits: boolean;
  customer_portal: boolean;
}

/**
 * Capability Matrix — état réel de la plateforme.
 */
export const CAPABILITIES: Record<PaymentMethod, ProviderCapabilities> = {
  ORANGE_MONEY: {
    payments: true,
    payment_links: true,
    qr_code: false,
    payouts: false,
    withdrawals: true,
    opr: false,
    splits: false,
    customer_portal: false,
  },
};

export const CAPABILITY_DESCRIPTIONS: Record<PaymentMethod, Record<Capability, string>> = {
  ORANGE_MONEY: {
    payments: "Paiement via Orange Money (Mali)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non disponible",
    payouts: "Indisponible — utilisez withdrawals.create (retrait manuel)",
    withdrawals: "Retrait manuel vers Orange Money (50 000 à 5 000 000 FCFA)",
    opr: "Non disponible",
    splits: "Non disponible",
    customer_portal: "Portail client SahelPay (indépendant du rail)",
  },
};

/** @deprecated Utilisez CAPABILITY_DESCRIPTIONS */
export const CAPABILITY_JUSTIFICATIONS = CAPABILITY_DESCRIPTIONS;

export function hasCapability(method: PaymentMethod, capability: Capability): boolean {
  const caps = CAPABILITIES[method];
  if (!caps) return false;
  return caps[capability] === true;
}

export function getCapabilities(method: PaymentMethod): ProviderCapabilities | null {
  return CAPABILITIES[method] || null;
}

export function getCapabilityDescription(method: PaymentMethod, capability: Capability): string {
  return CAPABILITY_DESCRIPTIONS[method]?.[capability] || "Non documenté";
}

/** @deprecated Utilisez getCapabilityDescription */
export function getJustification(method: PaymentMethod, capability: Capability): string {
  return getCapabilityDescription(method, capability);
}

export function getMethodsWithCapability(capability: Capability): PaymentMethod[] {
  return (Object.keys(CAPABILITIES) as PaymentMethod[]).filter(
    (method) => CAPABILITIES[method][capability]
  );
}

/** @deprecated Utilisez getMethodsWithCapability */
export function getProvidersWithCapability(capability: Capability): PaymentMethod[] {
  return getMethodsWithCapability(capability);
}
