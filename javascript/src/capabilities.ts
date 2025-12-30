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

/**
 * Méthodes de paiement disponibles pour le client
 * 
 * Note: Le routing interne (INTOUCH, CINETPAY, etc.) est transparent.
 * SahelPay choisit automatiquement le meilleur gateway selon le coût et la disponibilité.
 */
export type PaymentMethod =
  | "ORANGE_MONEY"   // Orange Money (Mali, Sénégal, CI...)
  | "WAVE"           // Wave (Sénégal, Mali, CI)
  | "MOOV"           // Moov Money (Mali, Bénin, Togo)
  | "CARD"           // Carte bancaire (VISA/Mastercard/GIM-UEMOA)
  | "VISA"           // Carte VISA
  | "MASTERCARD"     // Carte Mastercard
  | "GIM_UEMOA";     // Carte régionale GIM-UEMOA

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
 * Définit ce que chaque MÉTHODE DE PAIEMENT supporte du point de vue client.
 * Le routing interne (via quel gateway) est transparent et géré par SahelPay.
 */
export const CAPABILITIES: Record<PaymentMethod, ProviderCapabilities> = {
  /**
   * Orange Money (Mali, Sénégal, CI...)
   * 
   * Le routing se fait automatiquement vers le gateway optimal:
   * - ORANGE_DIRECT: moins cher, intégration directe
   * - INTOUCH: Push USSD, meilleure UX
   */
  ORANGE_MONEY: {
    payments: true,           // Paiement mobile
    payment_links: true,      // Liens de paiement
    qr_code: false,           // Pas de QR natif
    payouts: true,            // Envoi d'argent (via gateway optimal)
    withdrawals: true,        // Retraits
    opr: true,                // Request-to-pay (via Push USSD si dispo)
    splits: false,            // Pas de split natif
    customer_portal: false,
  },

  /**
   * Wave (Sénégal, Mali, Côte d'Ivoire)
   * 
   * QR Code natif + Push notification
   */
  WAVE: {
    payments: true,
    payment_links: true,
    qr_code: true,            // QR natif Wave
    payouts: true,            // Wave Payout API
    withdrawals: true,        // Wave Cash-out
    opr: true,                // Request-to-pay
    splits: false,
    customer_portal: false,
  },

  /**
   * Moov Money (Mali, Bénin, Togo)
   */
  MOOV: {
    payments: true,
    payment_links: true,      // Via SahelPay
    qr_code: false,
    payouts: true,            // Via gateway optimal
    withdrawals: true,
    opr: true,                // Via Push USSD
    splits: false,
    customer_portal: false,
  },

  /**
   * Carte bancaire (générique - VISA/Mastercard/GIM)
   * 
   * Routé automatiquement vers le meilleur gateway cartes
   */
  CARD: {
    payments: true,
    payment_links: true,
    qr_code: false,
    payouts: false,           // Non supporté pour les cartes
    withdrawals: true,        // Virement bancaire
    opr: false,
    splits: true,             // Marketplace splits
    customer_portal: true,    // Gestion des cartes
  },

  /**
   * Carte VISA
   */
  VISA: {
    payments: true,
    payment_links: true,
    qr_code: false,
    payouts: false,
    withdrawals: true,
    opr: false,
    splits: true,
    customer_portal: true,
  },

  /**
   * Carte Mastercard
   */
  MASTERCARD: {
    payments: true,
    payment_links: true,
    qr_code: false,
    payouts: false,
    withdrawals: true,
    opr: false,
    splits: true,
    customer_portal: true,
  },

  /**
   * Carte GIM-UEMOA (régionale)
   */
  GIM_UEMOA: {
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

/**
 * Descriptions des capabilities par méthode de paiement
 * (pour documentation et support)
 */
export const CAPABILITY_DESCRIPTIONS: Record<PaymentMethod, Record<Capability, string>> = {
  ORANGE_MONEY: {
    payments: "Paiement via Orange Money (redirect + OTP)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non disponible",
    payouts: "Envoi d'argent vers Orange Money",
    withdrawals: "Retrait vers Orange Money",
    opr: "Request-to-pay via Push USSD",
    splits: "Via SahelPay Split",
    customer_portal: "Non disponible",
  },
  WAVE: {
    payments: "Paiement via Wave (QR + Push)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "QR Code Wave natif",
    payouts: "Envoi d'argent via Wave",
    withdrawals: "Retrait vers Wave",
    opr: "Request-to-pay Wave",
    splits: "Via SahelPay Split",
    customer_portal: "Non disponible",
  },
  MOOV: {
    payments: "Paiement via Moov Money (USSD/Push)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non disponible",
    payouts: "Envoi d'argent via Moov",
    withdrawals: "Retrait vers Moov",
    opr: "Request-to-pay via Push USSD",
    splits: "Via SahelPay Split",
    customer_portal: "Non disponible",
  },
  CARD: {
    payments: "Paiement par carte (3DS Secure)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non applicable",
    payouts: "Non supporté",
    withdrawals: "Virement bancaire",
    opr: "Non applicable",
    splits: "Marketplace splits",
    customer_portal: "Gestion des cartes enregistrées",
  },
  VISA: {
    payments: "Paiement par carte VISA (3DS Secure)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non applicable",
    payouts: "Non supporté",
    withdrawals: "Virement bancaire",
    opr: "Non applicable",
    splits: "Marketplace splits",
    customer_portal: "Gestion des cartes enregistrées",
  },
  MASTERCARD: {
    payments: "Paiement par Mastercard (3DS Secure)",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non applicable",
    payouts: "Non supporté",
    withdrawals: "Virement bancaire",
    opr: "Non applicable",
    splits: "Marketplace splits",
    customer_portal: "Gestion des cartes enregistrées",
  },
  GIM_UEMOA: {
    payments: "Paiement par carte GIM-UEMOA",
    payment_links: "Liens de paiement SahelPay",
    qr_code: "Non applicable",
    payouts: "Non supporté",
    withdrawals: "Virement bancaire",
    opr: "Non applicable",
    splits: "Via SahelPay Split",
    customer_portal: "Non disponible",
  },
};

/** @deprecated Utilisez CAPABILITY_DESCRIPTIONS */
export const CAPABILITY_JUSTIFICATIONS = CAPABILITY_DESCRIPTIONS;

/**
 * Vérifier si une méthode de paiement supporte une capability
 */
export function hasCapability(method: PaymentMethod, capability: Capability): boolean {
  const caps = CAPABILITIES[method];
  if (!caps) return false;
  return caps[capability] === true;
}

/**
 * Obtenir toutes les capabilities d'une méthode de paiement
 */
export function getCapabilities(method: PaymentMethod): ProviderCapabilities | null {
  return CAPABILITIES[method] || null;
}

/**
 * Obtenir la description d'une capability
 */
export function getCapabilityDescription(method: PaymentMethod, capability: Capability): string {
  return CAPABILITY_DESCRIPTIONS[method]?.[capability] || "Non documenté";
}

/** @deprecated Utilisez getCapabilityDescription */
export function getJustification(method: PaymentMethod, capability: Capability): string {
  return getCapabilityDescription(method, capability);
}

/**
 * Lister les méthodes de paiement supportant une capability
 */
export function getMethodsWithCapability(capability: Capability): PaymentMethod[] {
  return (Object.keys(CAPABILITIES) as PaymentMethod[]).filter(
    (method) => CAPABILITIES[method][capability]
  );
}

/** @deprecated Utilisez getMethodsWithCapability */
export function getProvidersWithCapability(capability: Capability): PaymentMethod[] {
  return getMethodsWithCapability(capability);
}
