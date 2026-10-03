/**
 * SahelPay SDK for JavaScript/TypeScript
 * 
 * Intégration simple des paiements Mobile Money en Afrique de l'Ouest
 * 
 * @example
 * ```typescript
 * import SahelPay from '@sahelpay/sdk';
 * 
 * const sahelpay = new SahelPay({
 *   secretKey: 'sk_live_xxx',
 *   environment: 'production'
 * });
 * 
 * const payment = await sahelpay.payments.create({
 *   amount: 5000,
 *   currency: 'XOF',
 *   provider: 'ORANGE_MONEY',
 *   customer_phone: '+22370000000',
 *   description: 'Commande #123'
 * // Attendre la confirmation (Polling automatique)
 * const confirmedPayment = await sahelpay.payments.poll(payment.reference_id);
 * console.log('Paiement confirmé:', confirmedPayment.status);
 * ```
 */

import { SahelPayError } from './errors';

export { SahelPayError } from './errors';
export {
  CAPABILITIES,
  CAPABILITY_DESCRIPTIONS,
  hasCapability,
  getCapabilities,
  getCapabilityDescription,
  getMethodsWithCapability,
  type PaymentMethod,
  type Capability,
  type ProviderCapabilities,
} from './capabilities';

async function generateIdempotencyKey(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    (await import('node:crypto')).randomUUID();
  return `sdk_${uuid}`;
}

declare const require: any;

export interface SahelPayConfig {
  secretKey: string;
  environment?: 'sandbox' | 'production';
  baseUrl?: string;
  timeout?: number;
}

export interface MarketplaceMetadata {
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  items_count?: number;
  shipping_address?: string;
  delivery_zone?: string;
  delivery_fee?: number;
  order_date?: string;
  merchant_name?: string;
}

export interface CreatePaymentParams {
  amount: number;
  currency?: string;
  provider?: string;
  /**
   * Méthode de paiement.
   * - ORANGE_MONEY: Orange Money (Mali) — seul rail intégré
   * - MOBILE_MONEY: alias résolu vers ORANGE_MONEY
   *
   * Toute autre valeur est rejetée par l'API avec une erreur 400.
   */
  payment_method?: 'ORANGE_MONEY' | 'MOBILE_MONEY';
  country?: string;
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
  description?: string;
  client_reference?: string;
  marketplace?: MarketplaceMetadata;
  /**
   * Envoie `metadata.sandbox=true` : le paiement part vers l'environnement de
   * test de l'opérateur. L'intégration est validée de bout en bout.
   *
   * Ne coupe pas l'appel opérateur — pour cela, utilisez `mock`.
   */
  sandbox?: boolean;
  /**
   * Envoie `metadata.sahelpay_mock=true` : simulateur SahelPay, **aucun appel
   * opérateur**. Le statut final est piloté par le montant (4000 réussi,
   * 4001 échoué, 4002 en attente, 4003 erreur opérateur).
   *
   * Nécessite une clé `sk_test_...` : l'API rejette ce flag en production.
   */
  mock?: boolean;
  metadata?: Record<string, any>;
  callback_url?: string;
  return_url?: string;
  success_url?: string;
  cancel_url?: string;
  /** Stable par commande ; réutilisez-la pour les retries. Générée si absente. */
  idempotency_key?: string;
  /** Partenaires SPAY : lignes du catalogue validé ; le montant doit en être le total exact. */
  items?: Array<{ product_id: string; quantity?: number }>;
  /**
   * Si true, redirige vers la page de checkout SahelPay avant le provider.
   * Si false, initie directement le paiement et redirige vers le provider.
   * @default true
   */
  hosted_checkout?: boolean;
}

export interface Payment {
  id: string;
  reference_id: string;
  client_reference?: string;
  amount: number;
  currency: string;
  provider: string;
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  customer_phone: string;
  description?: string;
  payment_method?: string;
  country?: string;
  provider_ref?: string;
  redirect_url?: string;
  expires_at?: string;
  checkout_url?: string;
  ussd_code?: string;
  metadata?: Record<string, any>;
  fee_calculation?: {
    platform_fee: number;
    provider_fee: number;
    net_merchant: number;
    tax_amount: number;
  };
  ledger_entries?: any[];
  provider_events?: any[];
  /**
   * Gateway utilisé pour ce paiement. Informatif, destiné au monitoring.
   * Exemple: 'ORANGE_DIRECT'
   */
  gateway_used?: string;
  /**
   * Raison du routing (explication du choix du gateway)
   * Exemples: 'Orange WebPay Direct - Fallback faible coût',
   *           'Intouch PSP - Push USSD pour meilleure UX Mobile Money',
   *           'N-Genius - Hosted Payment Page (Visa/Mastercard)'
   */
  routing_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentLink {
  id: string;
  title: string;
  price: number;
  currency: string;
  slug: string;
  url: string;
  is_active: boolean;
}

export interface CreatePayoutParams {
  amount: number;
  /** Orange Money est le seul rail intégré; l'API rejette le reste avec un 400. */
  provider: 'ORANGE_MONEY';
  recipient_phone: string;
  recipient_name?: string;
  description?: string;
  type?: 'MERCHANT_WITHDRAWAL' | 'SUPPLIER_PAYMENT' | 'SALARY' | 'COMMISSION' | 'REFUND' | 'OTHER';
  metadata?: Record<string, any>;
  idempotency_key?: string;
}

export interface Payout {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  net_amount: number;
  currency: string;
  provider: string;
  recipient_phone: string;
  recipient_name?: string;
  type: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface PayoutStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  success_rate: number;
  total_volume: number;
}

/** Événements webhook émis par SahelPay vers le marchand. */
export type WebhookEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'payment.pending'
  | 'payment.expired'
  | 'payment.updated'
  | 'secure_order.paid'
  | 'secure_order.released'
  | 'secure_order.refunded'
  | 'secure_order.disputed'
  | 'secure_order.cancelled'
  | 'subscription.renewed'
  | 'subscription.payment_due'
  | 'invoice.created'
  | 'invoice.paid'
  | 'webhook.test';

export interface WebhookEvent {
  /** Identifiant unique de l'événement : dédupliquez sur ce champ. */
  id: string;
  /** Les événements ajoutés plus tard arrivent comme des chaînes : ignorez ceux que vous ne gérez pas. */
  event: WebhookEventType | (string & {});
  version?: string;
  data: Payment | Payout | SubscriptionWebhookData | Refund | Record<string, any>;
  timestamp: string;
}

// ==================== REFUNDS ====================

export interface Refund {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  reason?: string;
  metadata?: Record<string, any>;
  client_reference?: string;
  created_at: string;
}

export interface CreateRefundParams {
  /** Identifiant du paiement (PaymentIntent) à rembourser. */
  payment_id: string;
  /** Montant entier en XOF. */
  amount: number;
  reason?: string;
  refund_fees?: boolean;
  /** Stable par remboursement ; réutilisez-la pour les retries. Générée si absente. */
  idempotency_key?: string;
}

// ==================== PLANS ====================

export type PlanInterval = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  amount: number;
  currency: string;
  interval: PlanInterval;
  is_active: boolean;
  /** Renvoyé par `plans.list()` uniquement. */
  subscriber_count?: number;
  created_at: string;
}

export interface CreatePlanParams {
  name: string;
  amount: number;
  interval: 'WEEKLY' | 'MONTHLY';
  description?: string;
}

export interface UpdatePlanParams {
  name?: string;
  description?: string;
  amount?: number;
  is_active?: boolean;
}

export interface DeletePlanResult {
  /** false si le plan avait déjà des abonnements : il est alors seulement désactivé. */
  deleted: boolean;
  is_active?: boolean;
  message?: string;
}

export interface SendPlanLinkResult {
  subscription_id: string;
  invoice_id: string;
  payment_link: {
    id: string;
    url: string;
    amount: number;
  };
  sms_sent: boolean;
  message: string;
}

// ==================== SUBSCRIPTIONS ====================

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE';

export interface Subscription {
  id: string;
  /** Renvoyé par `subscriptions.create()` ; dans `list()`, utilisez `plan.id`. */
  plan_id?: string;
  plan_name?: string;
  customer_phone: string;
  status: SubscriptionStatus;
  next_billing_date: string;
  plan?: {
    id: string;
    name: string;
    amount: number;
    interval: string;
  };
  created_at: string;
}

export interface CreateSubscriptionParams {
  plan_id: string;
  customer_phone: string;
  start_date?: string; // ISO date, defaults to now
}

export interface CreateSubscriptionWithPaymentResult {
  subscription: {
    id: string;
    plan_id: string;
    plan_name: string;
    plan_amount: number;
    customer_phone: string;
    /** `INCOMPLETE` jusqu'au paiement de la première facture. */
    status: SubscriptionStatus;
    next_billing_date: string;
    created_at: string;
  };
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    total: number;
    amount_due: number;
  };
  payment_link: {
    id: string;
    url: string;
    amount: number;
  };
}

export interface SubscriptionWebhookData {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  customer_phone: string;
  amount: number;
  currency: string;
  payment_link_id: string;
  payment_url: string;
  billing_date: string;
  expires_at?: string;
}

// ==================== CUSTOMERS ====================

/**
 * Client final d'un marchand. Créé automatiquement par SahelPay (abonnement,
 * lien de plan, session portail) : il n'y a pas d'API de création directe.
 */
export interface Customer {
  id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  transaction_count: number;
  total_spent: number;
  last_transaction_at?: string | null;
  created_at: string;
}

export interface ListCustomersParams {
  /** Filtre sur téléphone, nom ou e-mail. */
  search?: string;
  page?: number;
  limit?: number;
}

// ==================== PORTAL ====================

export interface PortalSession {
  id: string;
  url: string;
  customer_id: string;
  expires_at: string;
}

export interface CreatePortalSessionParams {
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
  return_url?: string;
}

class PaymentsAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouveau paiement
   */
  async create(params: CreatePaymentParams): Promise<Payment> {
    const provider = params.provider;
    // Orange Money est le seul rail intégré; l'API rejette toute autre valeur
    // avec un 400, inutile de deviner une méthode carte ici.
    const inferredPaymentMethod: CreatePaymentParams['payment_method'] =
      params.payment_method;

    const customer = {
      phone: params.customer_phone,
      name: params.customer_name,
      email: params.customer_email,
    };

    const response = await this.client.request('POST', '/v1/payments', {
      amount: params.amount,
      currency: params.currency || 'XOF',
      provider,
      payment_method: inferredPaymentMethod,
      country: params.country,
      customer,
      customer_phone: params.customer_phone,
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      client_reference: params.client_reference,
      metadata: {
        ...(params.metadata || {}),
        ...(params.sandbox ? { sandbox: true } : {}),
        ...(params.mock ? { sahelpay_mock: true } : {}),
        ...(params.description ? { description: params.description } : {}),
        ...(params.marketplace ? { marketplace: params.marketplace } : {}),
      },
      return_url: params.return_url,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      hosted_checkout: params.hosted_checkout ?? true,
      items: params.items,
    }, {
      headers: {
        'X-Idempotency-Key': await generateIdempotencyKey(params.idempotency_key),
      },
    });

    const data = response.data;
    return {
      id: data.id,
      reference_id: data.id,
      client_reference: data.client_reference,
      amount: data.amount,
      currency: data.currency,
      provider: provider || data.payment_method,
      status: data.status,
      customer_phone: params.customer_phone,
      description: params.description,
      payment_method: data.payment_method,
      country: data.country,
      provider_ref: data.provider_ref,
      redirect_url: data.redirect_url,
      checkout_url: data.checkout_url,
      expires_at: data.expires_at,
      metadata: data.metadata,
      gateway_used: data.gateway_used,
      routing_reason: data.routing_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Obtenir les providers disponibles
   */
  async providers(): Promise<any[]> {
    const response = await this.client.request('GET', '/v1/payments/providers');
    return response.data;
  }

  /**
   * Recommander un provider basé sur le numéro de téléphone
   */
  async recommend(phone: string): Promise<any> {
    const response = await this.client.request('GET', `/v1/payments/recommend?phone=${encodeURIComponent(phone)}`);
    return response.data;
  }

  /**
   * Récupérer un paiement par référence
   */
  async retrieve(referenceId: string): Promise<Payment> {
    const response = await this.client.request('GET', `/v1/payments/${referenceId}/status`);
    const data = response.data;
    return {
      id: data.id,
      reference_id: data.id,
      client_reference: data.client_reference,
      amount: data.amount,
      currency: data.currency,
      provider: data.payment_method,
      status: data.status,
      customer_phone: data.customer?.phone || '',
      payment_method: data.payment_method,
      country: data.country,
      provider_ref: data.provider_ref,
      redirect_url: data.redirect_url,
      checkout_url: data.checkout_url,
      expires_at: data.expires_at,
      metadata: data.metadata,
      gateway_used: data.gateway_used,
      routing_reason: data.routing_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Rechercher un paiement par client_reference
   */
  async search(clientReference: string): Promise<Payment | null> {
    const response = await this.client.request('GET', `/v1/payments/search?client_reference=${encodeURIComponent(clientReference)}`);
    const data = response.data;
    if (!data) return null;
    
    return {
      id: data.id,
      reference_id: data.id,
      client_reference: data.client_reference,
      amount: data.amount,
      currency: data.currency,
      provider: data.provider_id || data.payment_method,
      status: data.status,
      customer_phone: data.metadata?.customer?.phone || data.customer_phone || '',
      description: data.metadata?.description,
      payment_method: data.payment_method,
      country: data.country || 'ML',
      provider_ref: data.provider_ref,
      metadata: data.metadata,
      gateway_used: data.gateway_used,
      routing_reason: data.routing_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Obtenir les détails complets d'un paiement (avec ledger et fees)
   */
  async details(id: string): Promise<Payment> {
    const response = await this.client.request('GET', `/v1/payments/${id}/details`);
    const data = response.data;

    return {
      id: data.id,
      reference_id: data.id,
      client_reference: data.client_reference,
      amount: data.amount,
      currency: data.currency,
      provider: data.provider,
      status: data.status,
      customer_phone: data.customer?.phone || '',
      description: data.metadata?.description,
      metadata: data.metadata,
      fee_calculation: data.fee_calculation,
      ledger_entries: data.ledger_entries,
      provider_events: data.provider_events,
      gateway_used: data.gateway_used,
      routing_reason: data.routing_reason,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Réconcilier manuellement un paiement
   */
  async reconcile(id: string): Promise<{ updated: boolean; newStatus?: string }> {
    const response = await this.client.request('POST', `/v1/payments/${id}/reconcile`);
    return response;
  }

  /**
   * Vérifier le statut d'un paiement
   */
  async checkStatus(referenceId: string): Promise<{ status: string; payment: Payment }> {
    const response = await this.client.request('GET', `/v1/payments/${referenceId}/status`);
    const data = response.data;
    return {
      status: data.status,
      payment: {
        id: data.id,
        reference_id: data.id,
        amount: data.amount,
        currency: data.currency,
        provider: data.payment_method,
        status: data.status,
        customer_phone: '',
        payment_method: data.payment_method,
        country: data.country,
        provider_ref: data.provider_ref,
        redirect_url: data.redirect_url,
        expires_at: data.expires_at,
        gateway_used: data.gateway_used,
        routing_reason: data.routing_reason,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  }

  async list(params?: { limit?: number; offset?: number; status?: string }): Promise<{ payments: Payment[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset !== undefined) query.set('offset', params.offset.toString());
    if (params?.status) query.set('status', params.status);
    
    const response = await this.client.request('GET', `/v1/payments/history?${query.toString()}`);
    const data = response.data;
    const transactions = data.transactions || [];

    return {
      payments: transactions.map((tx: any) => ({
        id: tx.id,
        reference_id: tx.reference || tx.reference_id,
        amount: Number(tx.amount),
        currency: tx.currency,
        provider: tx.provider,
        status: tx.status,
        customer_phone: tx.customer_phone,
        description: tx.description,
        gateway_used: tx.gateway_used,
        routing_reason: tx.routing_reason,
        created_at: tx.created_at,
        updated_at: tx.created_at,
      })),
      pagination: data.pagination,
    };
  }

  /**
   * Polling intelligent pour attendre la fin d'une transaction
   * @param referenceId Référence du paiement
   * @param options Configuration du polling
   */
  async poll(
    referenceId: string, 
    options: { 
      interval?: number; 
      timeout?: number; 
      onStatus?: (status: string, payment: Payment) => void 
    } = {}
  ): Promise<Payment> {
    const start = Date.now();
    const timeout = options.timeout || 120000; // 2 minutes par défaut
    let delay = options.interval || 2000;

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          // Check Status
          const { status, payment } = await this.checkStatus(referenceId);
          
          if (options.onStatus) {
            options.onStatus(status, payment);
          }

          if (['SUCCESS', 'FAILED', 'EXPIRED'].includes(status)) {
            resolve(payment);
            return;
          }

          if (Date.now() - start > timeout) {
            reject(new Error('Polling timeout'));
            return;
          }

          // Backoff simple: x1.5 chaque fois, max 10s
          delay = Math.min(delay * 1.5, 10000);
          setTimeout(check, delay);

        } catch (error) {
           // En cas d'erreur réseau, on retente quand même tant qu'on a du temps
           if (Date.now() - start > timeout) {
             reject(error);
           } else {
             setTimeout(check, delay);
           }
        }
      };
      
      check();
    });
  }
}

class PaymentLinksAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un lien de paiement
   */
  async create(params: { title: string; price: number; currency?: string; redirect_url?: string }): Promise<PaymentLink> {
    const response = await this.client.request('POST', '/v1/payment-links', params);
    const link = response.data;
    return {
      ...link,
      url: `https://pay.sahelpay.ml/${link.slug}`,
    };
  }

  /**
   * Lister les liens de paiement
   */
  async list(): Promise<PaymentLink[]> {
    const response = await this.client.request('GET', '/v1/payment-links');
    const links = response.data || [];
    return links.map((link: any) => ({
      ...link,
      url: `https://pay.sahelpay.ml/${link.slug}`,
    }));
  }

  /**
   * Récupérer un lien par slug
   */
  async retrieve(slug: string): Promise<PaymentLink> {
    const response = await this.client.request('GET', `/v1/payment-links/${slug}`);
    const link = response.data;
    return {
      ...link,
      url: `https://pay.sahelpay.ml/${link.slug}`,
    };
  }

  /**
   * Désactiver un lien
   */
  async deactivate(id: string): Promise<PaymentLink> {
    const response = await this.client.request('PATCH', `/v1/payment-links/${id}/deactivate`);
    const link = response.data;
    return {
      ...link,
      url: `https://pay.sahelpay.ml/${link.slug}`,
    };
  }

  async activate(id: string): Promise<PaymentLink> {
    const response = await this.client.request('PATCH', `/v1/payment-links/${id}/activate`);
    const link = response.data;
    return {
      ...link,
      url: `https://pay.sahelpay.ml/${link.slug}`,
    };
  }

  /**
   * Générer le QR code d'un lien
   */
  async qrCode(slug: string): Promise<{ qr_code: string; url: string }> {
    const response = await this.client.request('GET', `/v1/payment-links/${slug}/qr`);
    return response.data;
  }
}

/**
 * @deprecated Les payouts sont refusés par la plateforme (aucun transfert
 * automatique Orange Money). Utilisez `withdrawals.create` (retrait manuel).
 */
class PayoutsAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouveau payout (envoi d'argent)
   */
  async create(params: CreatePayoutParams): Promise<Payout> {
    if (params.amount < 100) {
      throw new SahelPayError('Le montant minimum est de 100 FCFA', 'INVALID_AMOUNT', 400);
    }
    if (params.amount > 5000000) {
      throw new SahelPayError('Le montant maximum est de 5,000,000 FCFA', 'INVALID_AMOUNT', 400);
    }

    const response = await this.client.request('POST', '/v1/payouts', params);
    return response.data;
  }

  /**
   * Récupérer un payout par référence
   */
  async retrieve(reference: string): Promise<Payout> {
    const response = await this.client.request('GET', `/v1/payouts/${reference}`);
    return response.data;
  }

  /**
   * Lister les payouts
   */
  async list(params?: { limit?: number; page?: number; status?: string; type?: string }): Promise<{ payouts: Payout[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);

    const response = await this.client.request('GET', `/v1/payouts?${query.toString()}`);
    return response.data;
  }

  /**
   * Annuler un payout en attente
   */
  async cancel(reference: string): Promise<Payout> {
    const response = await this.client.request('DELETE', `/v1/payouts/${reference}`);
    return response.data;
  }

  /**
   * Obtenir les statistiques des payouts
   */
  async stats(): Promise<PayoutStats> {
    const response = await this.client.request('GET', '/v1/payouts/stats');
    return response.data;
  }

  /**
   * Polling pour attendre la fin d'un payout
   */
  async poll(
    reference: string,
    options: {
      interval?: number;
      timeout?: number;
      onStatus?: (status: string, payout: Payout) => void;
    } = {}
  ): Promise<Payout> {
    const start = Date.now();
    const timeout = options.timeout || 120000;
    let delay = options.interval || 2000;

    return new Promise((resolve, reject) => {
      const check = async () => {
        try {
          const payout = await this.retrieve(reference);

          if (options.onStatus) {
            options.onStatus(payout.status, payout);
          }

          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(payout.status)) {
            resolve(payout);
            return;
          }

          if (Date.now() - start > timeout) {
            reject(new SahelPayError('Polling timeout', 'TIMEOUT', 408));
            return;
          }

          delay = Math.min(delay * 1.5, 10000);
          setTimeout(check, delay);
        } catch (error) {
          if (Date.now() - start > timeout) {
            reject(error);
          } else {
            setTimeout(check, delay);
          }
        }
      };

      check();
    });
  }
}

export interface Withdrawal {
  id: string;
  reference: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  recipient_phone: string;
  recipient_name?: string;
  created_at: string;
  completed_at?: string;
}

export interface Balance {
  available: number;
  pending: number;
  currency: string;
}

class WithdrawalsAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Obtenir le solde disponible
   */
  async balance(): Promise<Balance> {
    const response = await this.client.request('GET', '/v1/withdrawals/balance');
    return response.data;
  }

  /**
   * Créer un retrait
   */
  async create(params: {
    /** Entier en FCFA, de 50 000 à 5 000 000. Traité manuellement par SahelPay. */
    amount: number;
    /** Numéro Orange Money qui reçoit les fonds. */
    phone_number: string;
    provider?: 'ORANGE_MONEY';
    notes?: string;
    /** Frais annoncés par GET /v1/withdrawals/quote (refus si les frais ont changé). */
    quoted_fee?: number;
    /** Stable par retrait ; réutilisez-la pour les retries. Générée si absente. */
    idempotency_key?: string;
  }): Promise<Withdrawal> {
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', '/v1/withdrawals', { provider: 'ORANGE_MONEY', ...body }, {
      headers: {
        'X-Idempotency-Key': await generateIdempotencyKey(idempotency_key),
      },
    });
    return response.data;
  }

  /**
   * Devis avant confirmation (frais, montant débité, montant reçu).
   * Passez `fee` comme `quoted_fee` à create() : l'API refuse (409) si les frais ont changé.
   */
  async quote(amount: number): Promise<any> {
    const response = await this.client.request('GET', `/v1/withdrawals/quote?amount=${encodeURIComponent(String(amount))}`);
    return response.data;
  }

  /**
   * Lister les retraits
   */
  async list(params?: { limit?: number; page?: number; status?: string }): Promise<{ withdrawals: Withdrawal[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.page) query.set('page', params.page.toString());
    if (params?.status) query.set('status', params.status);

    const response = await this.client.request('GET', `/v1/withdrawals?${query.toString()}`);
    return response.data;
  }

  /**
   * Obtenir les statistiques des retraits
   */
  async stats(): Promise<any> {
    const response = await this.client.request('GET', '/v1/withdrawals/stats');
    return response.data;
  }

  /**
   * Annuler un retrait en attente
   */
  async cancel(id: string): Promise<Withdrawal> {
    const response = await this.client.request('PATCH', `/v1/withdrawals/${id}/cancel`);
    return response.data;
  }
}

// ==================== PUBLIC PLAN (for pricing widgets) ====================

export interface PublicPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  interval_label: string;
  features: string[];
  checkout_url?: string;
}

export interface PublicPlansResponse {
  merchant: {
    id: string;
    name: string;
  };
  plans: PublicPlan[];
}

// ==================== PLANS API ====================

class PlansAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouveau plan d'abonnement
   * POST /v1/billing/plans
   */
  async create(params: CreatePlanParams): Promise<Plan> {
    const response = await this.client.request('POST', '/v1/billing/plans', params);
    return response.data;
  }

  /**
   * Lister tous les plans
   * GET /v1/billing/plans
   */
  async list(): Promise<Plan[]> {
    const response = await this.client.request('GET', '/v1/billing/plans');
    return response.data || [];
  }

  /**
   * Modifier un plan
   * PATCH /v1/billing/plans/:id
   */
  async update(id: string, params: UpdatePlanParams): Promise<{ success: boolean }> {
    return this.client.request('PATCH', `/v1/billing/plans/${id}`, params);
  }

  /**
   * Désactiver un plan (alias de update({ is_active: false }))
   */
  async deactivate(id: string): Promise<{ success: boolean }> {
    return this.update(id, { is_active: false });
  }

  /**
   * Supprimer un plan. S'il a déjà des abonnements, il est seulement désactivé
   * (`deleted: false`).
   * DELETE /v1/billing/plans/:id
   */
  async delete(id: string): Promise<DeletePlanResult> {
    const response = await this.client.request('DELETE', `/v1/billing/plans/${id}`);
    return response.data;
  }

  /**
   * Créer un abonnement INCOMPLETE et un lien de paiement pour un client.
   * POST /v1/billing/plans/:id/send-link
   */
  async sendLink(id: string, params: { customer_phone: string }): Promise<SendPlanLinkResult> {
    const response = await this.client.request('POST', `/v1/billing/plans/${id}/send-link`, params);
    return response.data;
  }

  /**
   * Récupérer les plans publics d'un merchant (sans authentification)
   * Idéal pour les pricing pages et widgets
   * 
   * @example
   * ```typescript
   * // Sans authentification - pour pricing pages
   * const plans = await SahelPay.getPublicPlans('merchant-id');
   * ```
   */
  static async getPublic(merchantId: string, baseUrl?: string): Promise<PublicPlansResponse> {
    const url = baseUrl || 'https://api.sahelpay.ml';
    const response = await fetch(`${url}/v1/public/plans?merchant_id=${merchantId}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to fetch plans');
    }
    return data.data;
  }

  /**
   * Récupérer un plan public par ID (sans authentification)
   */
  static async getPublicPlan(planId: string, baseUrl?: string): Promise<PublicPlan> {
    const url = baseUrl || 'https://api.sahelpay.ml';
    const response = await fetch(`${url}/v1/public/plans/${planId}`);
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Plan not found');
    }
    return data.data;
  }
}

// ==================== SUBSCRIPTIONS API ====================

class SubscriptionsAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouvel abonnement
   * @example
   * ```typescript
   * const subscription = await sahelpay.subscriptions.create({
   *   plan_id: 'plan_xxx',
   *   customer_phone: '+22370000000',
   * });
   * ```
   */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    const response = await this.client.request('POST', '/v1/billing/subscriptions', params);
    return response.data;
  }

  /**
   * Lister tous les abonnements
   * GET /v1/billing/subscriptions
   */
  async list(params?: {
    status?: SubscriptionStatus;
  }): Promise<{ subscriptions: Subscription[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);

    const qs = query.toString();
    const response = await this.client.request('GET', `/v1/billing/subscriptions${qs ? `?${qs}` : ''}`);
    return response.data;
  }

  /**
   * Annuler un abonnement
   * DELETE /v1/billing/subscriptions/:id
   */
  async cancel(id: string): Promise<{ success: boolean }> {
    const response = await this.client.request('DELETE', `/v1/billing/subscriptions/${id}`);
    return response;
  }

  /**
   * Créer un abonnement avec lien de paiement immédiat
   * 
   * Cette méthode crée un abonnement ET génère un lien de paiement en une seule requête.
   * Idéal pour les intégrations SaaS où vous voulez envoyer immédiatement un lien de paiement.
   * 
   * @example
   * ```typescript
   * const result = await sahelpay.subscriptions.createWithPayment({
   *   plan_id: 'plan_xxx',
   *   customer_phone: '+22370000000',
   *   redirect_url: 'https://myapp.com/billing?success=true',
   *   metadata: { organization_id: 'org_123' },
   * });
   * 
   * console.log(result.subscription.id);
   * console.log(result.payment_link.url); // URL à envoyer au client
   * ```
   */
  async createWithPayment(params: {
    plan_id: string;
    customer_phone: string;
    redirect_url?: string;
    metadata?: Record<string, any>;
  }): Promise<CreateSubscriptionWithPaymentResult> {
    const response = await this.client.request('POST', '/v1/billing/subscriptions/with-payment', params);
    return response.data;
  }
}

// ==================== CUSTOMERS API ====================

class CustomersAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Lister les clients du marchand.
   * GET /v1/billing/customers
   *
   * Les clients sont créés automatiquement (abonnement, lien de plan, session
   * portail) : il n'y a pas d'API de création, mise à jour ou suppression.
   */
  async list(params?: ListCustomersParams): Promise<{ customers: Customer[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());

    const qs = query.toString();
    const response = await this.client.request('GET', `/v1/billing/customers${qs ? `?${qs}` : ''}`);
    return response.data;
  }
}

// ==================== PORTAL API ====================

// ==================== REFUNDS API ====================

class RefundsAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un remboursement.
   *
   * En production, POST /v1/refunds répond **503** (`REFUNDS_UNAVAILABLE`) :
   * les remboursements en ligne ne sont pas encore disponibles. Contactez
   * SahelPay pour rembourser un client. GET /v1/refunds n'existe pas.
   *
   * `X-Idempotency-Key` est obligatoire ; générée si absente.
   */
  async create(params: CreateRefundParams): Promise<Refund> {
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', '/v1/refunds', body, {
      headers: {
        'X-Idempotency-Key': await generateIdempotencyKey(idempotency_key),
      },
    });
    return response.data;
  }
}

class PortalAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer une session Customer Portal
   * 
   * Permet à vos clients de gérer leurs abonnements, méthodes de paiement
   * et consulter leur historique de transactions.
   * 
   * @example
   * ```typescript
   * const session = await sahelpay.portal.createSession({
   *   customer_phone: '+22370000000',
   *   return_url: 'https://monapp.com/account'
   * });
   * 
   * // Redirigez le client vers session.url
   * window.location.href = session.url;
   * ```
   */
  async createSession(params: CreatePortalSessionParams): Promise<PortalSession> {
    const response = await this.client.request('POST', '/v1/portal/sessions', params);
    return response.data;
  }
}

type NodeCrypto = {
  createHmac(algorithm: string, key: string): { update(data: string): { digest(encoding: 'hex'): string } };
  timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
};

/**
 * Module crypto de Node, en CommonJS comme en ESM : `require` n'existe pas
 * dans un module ESM (le build .mjs levait « Dynamic require of "crypto" »).
 */
function loadNodeCrypto(): NodeCrypto {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  if (typeof proc?.getBuiltinModule === 'function') {
    return proc.getBuiltinModule('node:crypto') as NodeCrypto;
  }
  if (typeof require === 'function') {
    return require('crypto') as NodeCrypto;
  }
  throw new Error(
    'SahelPay: vérification de webhook impossible dans ce runtime ESM (Node >= 20.16 requis, ou utilisez le build CommonJS).',
  );
}

/**
 * API pour la gestion des webhooks
 * 
 * SahelPay utilise un format de signature Stripe-like:
 * - Header: X-SahelPay-Signature
 * - Format: t=<timestamp>,v1=<signature>
 * - Signature: HMAC_SHA256(secret, "${timestamp}.${raw_body}")
 */
class WebhooksAPI {
  private static readonly DEFAULT_TOLERANCE = 300; // 5 minutes

  constructor(private client: SahelPayClient) {}

  /**
   * Déclencher un webhook de connectivité vers l'URL configurée du marchand.
   *
   * L'API envoie un événement webhook.test signé avec le secret webhook du marchand.
   */
  async test(): Promise<any> {
    const response = await this.client.request('POST', '/v1/webhooks/test');
    return response.data;
  }

  /**
   * Parser le header de signature (format: t=...,v1=...)
   */
  private parseSignatureHeader(header: string): { timestamp: string | null; signature: string | null } {
    const parts: Record<string, string> = {};
    
    header.split(',').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

    return {
      timestamp: parts['t'] || null,
      signature: parts['v1'] || null,
    };
  }

  /**
   * Vérifier la signature d'un webhook (format Stripe-like)
   * 
   * @param payload Le body brut de la requête (string)
   * @param signatureHeader Le header X-SahelPay-Signature complet
   * @param secret Le secret webhook (whsec_...)
   * @param tolerance Tolérance en secondes pour le timestamp (défaut: 300)
   * @returns true si la signature est valide
   * @throws Error si le format est invalide ou la signature incorrecte
   */
  verifySignature(
    payload: string, 
    signatureHeader: string, 
    secret: string, 
    tolerance: number = WebhooksAPI.DEFAULT_TOLERANCE
  ): boolean {
    if (typeof window !== 'undefined') {
      console.warn('Webhook verification should be done server-side');
      return false;
    }

    const crypto = loadNodeCrypto();
    const safeEqual = (a: string, b: string): boolean => {
      const encoder = new TextEncoder();
      const aBuffer = encoder.encode(a);
      const bBuffer = encoder.encode(b);
      return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
    };

    const { timestamp, signature } = this.parseSignatureHeader(signatureHeader);

    if (timestamp && signature) {
      const timestampNum = Number(timestamp);
      if (!Number.isFinite(timestampNum)) return false;

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestampNum) > tolerance) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');

      return safeEqual(signature, expectedSignature);
    }

    // Compatibilité legacy : header = hash direct du body
    if (signatureHeader.length === 64) {
      const expectedLegacy = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return safeEqual(signatureHeader, expectedLegacy);
    }

    return false;
  }

  /**
   * Construire et vérifier un événement webhook
   * 
   * @param payload Le body brut de la requête (string ou Buffer)
   * @param signatureHeader Le header X-SahelPay-Signature
   * @param secret Le secret webhook (optionnel si passé au constructeur)
   * @param tolerance Tolérance en secondes pour le timestamp
   * @returns L'événement webhook vérifié
   * @throws SahelPayError si la signature est invalide
   */
  constructEvent(
    payload: string | Buffer, 
    signatureHeader: string, 
    secret?: string,
    tolerance: number = WebhooksAPI.DEFAULT_TOLERANCE
  ): WebhookEvent {
    const payloadString = typeof payload === 'string' ? payload : payload.toString('utf8');
    const webhookSecret = secret || '';
    
    if (!webhookSecret) {
      throw new SahelPayError(
        'Webhook secret is required',
        'WEBHOOK_SECRET_MISSING',
        400
      );
    }

    if (!this.verifySignature(payloadString, signatureHeader, webhookSecret, tolerance)) {
      throw new SahelPayError(
        'Invalid webhook signature',
        'WEBHOOK_SIGNATURE_ERROR',
        400
      );
    }
    return JSON.parse(payloadString);
  }

  /**
   * Parser un événement webhook (alias pour constructEvent)
   * @deprecated Utilisez constructEvent() à la place
   */
  parseEvent(payload: string, signatureHeader: string, secret: string): WebhookEvent {
    return this.constructEvent(payload, signatureHeader, secret);
  }
}

class SahelPayClient {
  private baseUrl: string;
  private secretKey: string;
  private timeout: number;

  constructor(config: SahelPayConfig) {
    this.secretKey = config.secretKey;
    this.timeout = config.timeout || 30000;
    
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else if (config.environment === 'sandbox') {
      this.baseUrl = 'https://api.sahelpay.ml';
    } else {
      this.baseUrl = 'https://api.sahelpay.ml';
    }
  }

  async request(
    method: string,
    path: string,
    data?: any,
    requestOptions?: { headers?: Record<string, string> }
  ): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const requestInit: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SahelPay-SDK/1.0.0',
        ...(requestOptions?.headers || {}),
      },
    };

    if (data && method !== 'GET') {
      requestInit.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    requestInit.signal = controller.signal;

    try {
      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);

      const text = await response.text();
      let json: any = {};
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          throw new SahelPayError('Invalid JSON response', 'INVALID_RESPONSE', response.status);
        }
      }

      if (!response.ok) {
        throw new SahelPayError(
          json.error?.message || 'API Error',
          json.error?.code || 'UNKNOWN_ERROR',
          response.status
        );
      }

      if (json && json.success === false && json.error) {
        throw new SahelPayError(
          json.error?.message || 'API Error',
          json.error?.code || 'UNKNOWN_ERROR',
          typeof json.error.http_status === 'number' ? json.error.http_status : 400
        );
      }

      return json;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new SahelPayError('Request timeout', 'TIMEOUT', 408);
      }
      throw error;
    }
  }
}

// ==================== MERCHANTS API ====================

/**
 * Paramètres pour l'inscription d'un nouveau marchand
 */
export interface RegisterMerchantParams {
  name: string;
  email: string;
  password: string;
  phone?: string;
  business_type?: string;
}

/**
 * Réponse de l'inscription d'un marchand
 */
export interface RegisterMerchantResponse {
  merchant: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    business_type?: string;
  };
  api_keys: {
    public_key: string;
    secret_key: string;
  };
}

/**
 * Réponse de la connexion d'un marchand
 */
export interface LoginMerchantResponse {
  role: 'merchant' | 'admin';
  merchant: {
    id: string;
    name: string;
    email: string;
  };
  api_keys: {
    public_key: string;
    secret_key: string;
  };
}

/**
 * API pour l'onboarding des marchands
 * 
 * Note: Ces méthodes sont statiques car elles ne nécessitent pas d'authentification.
 * Elles sont utilisées pour créer un compte ou se connecter.
 * 
 * @example
 * ```typescript
 * // Inscription d'un nouveau marchand (depuis une app mobile)
 * const result = await SahelPay.merchants.register({
 *   name: 'Ma Boutique',
 *   email: 'contact@maboutique.ml',
 *   password: 'motdepasse123',
 *   phone: '+22370123456',
 *   business_type: 'e-commerce'
 * });
 * 
 * // Connexion d'un marchand existant
 * const login = await SahelPay.merchants.login({
 *   email: 'contact@maboutique.ml',
 *   password: 'motdepasse123'
 * });
 * 
 * // Maintenant vous pouvez initialiser le SDK avec les clés obtenues
 * const sahelpay = new SahelPay({
 *   secretKey: result.api_keys.secret_key
 * });
 * ```
 */
class MerchantsAPI {
  private static defaultBaseUrl = 'https://api.sahelpay.ml';

  /**
   * Inscription d'un nouveau marchand
   * 
   * @param params - Informations du marchand
   * @param baseUrl - URL de l'API (optionnel, par défaut production)
   * @returns Informations du marchand créé avec les clés API
   */
  static async register(
    params: RegisterMerchantParams,
    baseUrl?: string
  ): Promise<RegisterMerchantResponse> {
    const url = `${baseUrl || MerchantsAPI.defaultBaseUrl}/auth/register`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SahelPay-SDK/1.0.0',
      },
      body: JSON.stringify(params),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new SahelPayError(
        json.error?.message || 'Erreur lors de l\'inscription',
        json.error?.code || 'REGISTER_FAILED',
        response.status
      );
    }

    return json.data;
  }

  /**
   * Connexion d'un marchand existant
   * 
   * @param email - Email du marchand
   * @param password - Mot de passe
   * @param baseUrl - URL de l'API (optionnel)
   * @returns Informations du marchand avec les clés API
   */
  static async login(
    email: string,
    password: string,
    baseUrl?: string
  ): Promise<LoginMerchantResponse> {
    const url = `${baseUrl || MerchantsAPI.defaultBaseUrl}/auth/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SahelPay-SDK/1.0.0',
      },
      body: JSON.stringify({ email, password }),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new SahelPayError(
        json.error?.message || 'Email ou mot de passe incorrect',
        json.error?.code || 'LOGIN_FAILED',
        response.status
      );
    }

    return json.data;
  }

  /**
   * Demander la réinitialisation du mot de passe
   */
  static async forgotPassword(email: string, baseUrl?: string): Promise<void> {
    const url = `${baseUrl || MerchantsAPI.defaultBaseUrl}/auth/forgot-password`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new SahelPayError(
        json.error?.message || 'Erreur',
        json.error?.code || 'ERROR',
        response.status
      );
    }
  }

  /**
   * Réinitialiser le mot de passe avec un token
   */
  static async resetPassword(token: string, password: string, baseUrl?: string): Promise<void> {
    const url = `${baseUrl || MerchantsAPI.defaultBaseUrl}/auth/reset-password`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      throw new SahelPayError(
        json.error?.message || 'Token invalide ou expiré',
        json.error?.code || 'INVALID_TOKEN',
        response.status
      );
    }
  }
}

/**
 * Client principal SahelPay
 * 
 * @example
 * ```typescript
 * import SahelPay from '@sahelpay/sdk';
 * 
 * const sahelpay = new SahelPay({
 *   secretKey: 'sk_live_xxx',
 *   environment: 'production'
 * });
 * 
 * // Paiements
 * const payment = await sahelpay.payments.create({ ... });
 * 
 * // Abonnements
 * const plan = await sahelpay.plans.create({ name: 'Premium', amount: 5000, interval: 'MONTHLY' });
 * const subscription = await sahelpay.subscriptions.create({ plan_id: plan.id, customer_phone: '+22370000000' });
 * ```
 */
export class SahelPay {
  private client: SahelPayClient;
  
  public payments: PaymentsAPI;
  public paymentLinks: PaymentLinksAPI;
  /** @deprecated Les payouts sont refusés par la plateforme. Utilisez `withdrawals`. */
  public payouts: PayoutsAPI;
  public withdrawals: WithdrawalsAPI;
  public webhooks: WebhooksAPI;
  public refunds: RefundsAPI;
  public plans: PlansAPI;
  public subscriptions: SubscriptionsAPI;
  public customers: CustomersAPI;
  public portal: PortalAPI;

  constructor(config: SahelPayConfig) {
    if (!config.secretKey) {
      throw new Error('secretKey is required');
    }

    this.client = new SahelPayClient(config);
    this.payments = new PaymentsAPI(this.client);
    this.paymentLinks = new PaymentLinksAPI(this.client);
    this.payouts = new PayoutsAPI(this.client);
    this.withdrawals = new WithdrawalsAPI(this.client);
    this.webhooks = new WebhooksAPI(this.client);
    this.refunds = new RefundsAPI(this.client);
    this.plans = new PlansAPI(this.client);
    this.subscriptions = new SubscriptionsAPI(this.client);
    this.customers = new CustomersAPI(this.client);
    this.portal = new PortalAPI(this.client);
  }

  /**
   * Récupérer les plans publics d'un merchant (sans authentification)
   * Méthode statique - pas besoin d'instancier le client
   * 
   * @example
   * ```typescript
   * // Pour une pricing page (pas besoin de secretKey)
   * const { merchant, plans } = await SahelPay.getPublicPlans('merchant-id');
   * 
   * plans.forEach(plan => {
   *   console.log(`${plan.name}: ${plan.amount} ${plan.currency}/${plan.interval_label}`);
   * });
   * ```
   */
  static async getPublicPlans(merchantId: string, baseUrl?: string): Promise<PublicPlansResponse> {
    return PlansAPI.getPublic(merchantId, baseUrl);
  }

  /**
   * Récupérer un plan public par ID (sans authentification)
   */
  static async getPublicPlan(planId: string, baseUrl?: string): Promise<PublicPlan> {
    return PlansAPI.getPublicPlan(planId, baseUrl);
  }

  // ==================== MERCHANTS (ONBOARDING) ====================

  /**
   * API d'onboarding des marchands (statique - sans authentification)
   * 
   * @example
   * ```typescript
   * // Inscription d'un nouveau marchand
   * const result = await SahelPay.merchants.register({
   *   name: 'Ma Boutique',
   *   email: 'contact@maboutique.ml',
   *   password: 'motdepasse123',
   *   phone: '+22370123456'
   * });
   * 
   * console.log('Clé API:', result.api_keys.secret_key);
   * 
   * // Connexion
   * const login = await SahelPay.merchants.login('email', 'password');
   * ```
   */
  static merchants = MerchantsAPI;

  /**
   * Inscription d'un nouveau marchand (raccourci)
   */
  static async registerMerchant(params: RegisterMerchantParams, baseUrl?: string) {
    return MerchantsAPI.register(params, baseUrl);
  }

  /**
   * Connexion d'un marchand (raccourci)
   */
  static async loginMerchant(email: string, password: string, baseUrl?: string) {
    return MerchantsAPI.login(email, password, baseUrl);
  }
}

// Garder l'import default: import SahelPay from "@sahelpay/sdk"
export default SahelPay;
