/**
 * SahelPay SDK – Capability Matrix (Officielle)
 * 
 * Version: v1.0
 * Scope: Payment SDK – Multi-Providers
 * Principe: Toutes les fonctionnalités ne sont pas garanties par tous les providers.
 * 
 * ⚠️ IMPORTANT: La disponibilité des fonctionnalités dépend du provider sélectionné.
 * Le SDK SahelPay expose une interface unifiée, mais chaque provider possède 
 * ses propres limitations techniques et réglementaires.
 */

export type Provider =
  | "ORANGE_MONEY"
  | "WAVE"
  | "MOOV"
  | "VISA";

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
  /** Paiements entrants (collect) */
  payments: boolean;
  /** Liens de paiement réutilisables */
  payment_links: boolean;
  /** QR Code natif du provider */
  qr_code: boolean;
  /** Envoi d'argent (disbursement) */
  payouts: boolean;
  /** Retraits vers compte marchand */
  withdrawals: boolean;
  /** On-demand Payment Request (request-to-pay) */
  opr: boolean;
  /** Split payments (marketplace) */
  splits: boolean;
  /** Portail client intégré */
  customer_portal: boolean;
}

/**
 * Capability Matrix officielle
 * 
 * Document défendable face aux partenaires (Orange, Wave, etc.)
 * Chaque capability est documentée et justifiée.
 */
export const CAPABILITIES: Record<Provider, ProviderCapabilities> = {
  /**
   * Orange Money WebPay (Mali)
   * 
   * API: Orange Money Web Payment API v1
   * Mode: Redirect + OTP
   * Limitations: Pas de payout, pas de QR natif
   */
  ORANGE_MONEY: {
    payments: true,           // WebPay redirect + OTP
    payment_links: true,      // Via wrapper SahelPay
    qr_code: false,           // Pas de QR natif Orange
    payouts: false,           // Non supporté par Orange WebPay
    withdrawals: false,       // Non supporté
    opr: false,               // Pas de request-to-pay API
    splits: false,            // Pas de split natif
    customer_portal: false,   // Hors périmètre Orange
  },

  /**
   * Wave (Sénégal, Mali, Côte d'Ivoire)
   * 
   * API: Wave Business API
   * Mode: QR Code + Push notification
   * Capabilities: Paiements, Payouts, QR natif
   */
  WAVE: {
    payments: true,
    payment_links: true,
    qr_code: true,            // QR natif Wave
    payouts: true,            // Wave Payout API
    withdrawals: true,        // Wave Cash-out
    opr: true,                // Request-to-pay supporté
    splits: false,            // Pas de split natif
    customer_portal: false,
  },

  /**
   * Moov Money (Mali, Bénin, Togo)
   * 
   * API: Moov Money API
   * Mode: USSD / Push
   * Limitations: Fonctionnalités limitées
   */
  MOOV: {
    payments: true,
    payment_links: false,     // Pas de liens natifs
    qr_code: false,
    payouts: false,           // En développement
    withdrawals: false,
    opr: false,
    splits: false,
    customer_portal: false,
  },

  /**
   * VISA (via partenaire bancaire)
   * 
   * API: 3DS Secure / Checkout
   * Mode: Card payment
   * Capabilities: Full featured
   */
  VISA: {
    payments: true,
    payment_links: true,
    qr_code: false,
    payouts: true,            // Card disbursement
    withdrawals: true,
    opr: false,
    splits: true,             // Marketplace splits
    customer_portal: true,    // Saved cards portal
  },
};

/**
 * Justifications officielles (audit-proof)
 */
export const CAPABILITY_JUSTIFICATIONS: Record<Provider, Record<Capability, string>> = {
  ORANGE_MONEY: {
    payments: "Orange Web Payment API (session + redirect + notif)",
    payment_links: "Généré par SahelPay, Orange est destination",
    qr_code: "Orange WebPay ne génère pas de QR",
    payouts: "Aucune API payout exposée par Orange",
    withdrawals: "Pas de cash-out API disponible",
    opr: "Pas de request-to-pay dans Orange WebPay",
    splits: "Gestion interne SahelPay uniquement",
    customer_portal: "Hors périmètre Orange WebPay",
  },
  WAVE: {
    payments: "Wave Business API - Payment collection",
    payment_links: "Wave Payment Links API",
    qr_code: "Wave QR Code natif",
    payouts: "Wave Payout API",
    withdrawals: "Wave Cash-out API",
    opr: "Wave Request-to-Pay",
    splits: "Non disponible nativement",
    customer_portal: "Non disponible",
  },
  MOOV: {
    payments: "Moov Money USSD/Push API",
    payment_links: "Non supporté par Moov",
    qr_code: "Non disponible",
    payouts: "En cours de développement",
    withdrawals: "Non disponible",
    opr: "Non disponible",
    splits: "Non disponible",
    customer_portal: "Non disponible",
  },
  VISA: {
    payments: "3DS Secure Checkout",
    payment_links: "Hosted Payment Page",
    qr_code: "Non applicable aux cartes",
    payouts: "Visa Direct / Card Disbursement",
    withdrawals: "Bank transfer",
    opr: "Non applicable",
    splits: "Marketplace / Platform payments",
    customer_portal: "Saved cards management",
  },
};

/**
 * Vérifier si un provider supporte une capability
 */
export function hasCapability(provider: Provider, capability: Capability): boolean {
  const caps = CAPABILITIES[provider];
  if (!caps) return false;
  return caps[capability] === true;
}

/**
 * Obtenir toutes les capabilities d'un provider
 */
export function getCapabilities(provider: Provider): ProviderCapabilities | null {
  return CAPABILITIES[provider] || null;
}

/**
 * Obtenir la justification d'une capability
 */
export function getJustification(provider: Provider, capability: Capability): string {
  return CAPABILITY_JUSTIFICATIONS[provider]?.[capability] || "Non documenté";
}

/**
 * Lister les providers supportant une capability
 */
export function getProvidersWithCapability(capability: Capability): Provider[] {
  return (Object.keys(CAPABILITIES) as Provider[]).filter(
    (provider) => CAPABILITIES[provider][capability]
  );
}
