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

export const SDK_VERSION = '1.3.0';

async function generateIdempotencyKey(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    (await import('node:crypto')).randomUUID();
  return `sdk_${uuid}`;
}

declare const require: any;

function toQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

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
  /**
   * Numéro du payeur au format international (+223...). Facultatif avec le
   * checkout hébergé : la page SahelPay le demande au client.
   */
  customer_phone?: string;
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
  /**
   * @deprecated Ignoré : l'API n'a pas d'URL de callback par paiement. Les
   * webhooks partent vers les endpoints configurés pour l'application.
   */
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
  /** Application de la clé API qui a créé le paiement. */
  application_id?: string;
  /** Instructions de paiement à afficher au client (transfert Orange Money), si l'API en renvoie. */
  instructions?: any;
  amount: number;
  currency: string;
  provider: string;
  status: 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  customer_phone?: string;
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
  slug: string;
  /** URL publique à partager : https://pay.sahelpay.africa/<slug> */
  url: string;
  name?: string;
  description?: string | null;
  /** FIXED = prix imposé ; OPEN = montant libre entre min_amount et max_amount. */
  amount_mode?: 'FIXED' | 'OPEN';
  fixed_amount?: number | null;
  min_amount?: number;
  max_amount?: number;
  currency: string;
  success_redirect_url?: string | null;
  image_url?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  /** @deprecated Utilisez `name`. */
  title?: string;
  /** @deprecated Utilisez `fixed_amount`. */
  price?: number | null;
}

export interface CreatePaymentLinkParams {
  /** Nom affiché au client. `title` (ancien nom) reste accepté. */
  name?: string;
  description?: string;
  /**
   * FIXED (prix imposé) ou OPEN (montant libre). Par défaut : FIXED si un
   * montant (`fixed_amount` ou `price`) est fourni, sinon OPEN.
   */
  amount_mode?: 'FIXED' | 'OPEN';
  /** Prix en XOF, requis en mode FIXED. `price` (ancien nom) reste accepté. */
  fixed_amount?: number;
  /** Bornes du mode OPEN (défaut 100 et 500 000 XOF). */
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  /** URL de retour après paiement. `redirect_url` (ancien nom) reste accepté. */
  success_redirect_url?: string;
  image_url?: string;
  /** Date ISO 8601 d'expiration (absent = jamais). */
  expires_at?: string;
  /** Nombre maximum de paiements (absent = illimité). */
  max_uses?: number;
  /** Partenaires SPAY : produit du catalogue validé (le prix est imposé). */
  product_id?: string;
  /** @deprecated Utilisez `name`. */
  title?: string;
  /** @deprecated Utilisez `fixed_amount`. */
  price?: number;
  /** @deprecated Utilisez `success_redirect_url`. */
  redirect_url?: string;
}

export interface UpdatePaymentLinkParams {
  name?: string;
  description?: string;
  is_active?: boolean;
  min_amount?: number;
  max_amount?: number;
  success_redirect_url?: string;
}

const PAYMENT_PAGE_BASE_URL = 'https://pay.sahelpay.africa';

function withLinkUrl(link: any): PaymentLink {
  return { ...link, url: `${PAYMENT_PAGE_BASE_URL}/${link.slug}` };
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
  /** @deprecated Historical handler compatibility; not emitted by the current API. */
  | 'payment.cancelled'
  | 'refund.pending'
  | 'secure_order.paid'
  | 'secure_order.released'
  | 'secure_order.refunded'
  | 'secure_order.disputed'
  | 'secure_order.cancelled'
  | 'subscription.renewed'
  | 'subscription.cancelled'
  | 'subscription.payment_due'
  | 'invoice.created'
  | 'invoice.paid'
  | 'webhook.test';

export interface WebhookEnvelope<T extends string, D> {
  id: string;
  event: T;
  version?: string;
  livemode?: boolean;
  data: D;
  timestamp: string;
}

export type BillingWebhookEvent = {
  [K in keyof import('./billing').BillingEventPayloads]: WebhookEnvelope<K, import('./billing').BillingEventPayloads[K]>
}[keyof import('./billing').BillingEventPayloads];

/** Narrow event.event before reading data; ignore unhandled future event names. */
export type WebhookEvent = BillingWebhookEvent
  | WebhookEnvelope<Exclude<WebhookEventType, keyof import('./billing').BillingEventPayloads>, Record<string, any>>;

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

// Billing contracts are maintained together in billing.ts.
export * from './billing';
import type {
  Plan, CreatePlanParams, UpdatePlanParams, DeletePlanResult, SendPlanLinkResult,
  CustomerIdentity, Subscription, SubscriptionStatus, SubscriptionSnapshot,
  CreateSubscriptionParams, CreateSubscriptionWithPaymentParams,
  CreateSubscriptionWithPaymentResult, ImportSubscriptionParams,
  Customer, ListCustomersParams, PagePagination, Invoice, CreateInvoiceParams,
  ListInvoicesParams, InvoicePaymentLinkResult, ListPlansParams, ListSubscriptionsParams, CursorPagination, InvoicePagination, ReminderPreview,
} from './billing';

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

    const customer = Object.fromEntries(
      Object.entries({
        phone: params.customer_phone,
        name: params.customer_name,
        email: params.customer_email,
      }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

    const response = await this.client.request('POST', '/v1/payments', {
      amount: params.amount,
      currency: params.currency || 'XOF',
      provider,
      payment_method: inferredPaymentMethod,
      country: params.country,
      ...(Object.keys(customer).length ? { customer } : {}),
      customer_phone: params.customer_phone,
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      client_reference: params.client_reference,
      // Champ racine : l'API écrase metadata.description par cette valeur.
      description: params.description,
      metadata: {
        ...(params.metadata || {}),
        ...(params.sandbox ? { sandbox: true } : {}),
        ...(params.mock ? { sahelpay_mock: true } : {}),
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
      // La réponse de création ne renvoie pas client_reference : on garde la valeur envoyée.
      client_reference: data.client_reference ?? params.client_reference,
      application_id: data.application_id,
      instructions: data.instructions,
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
   * Expirer un paiement non terminal dont `expires_at` est dépassé.
   * Émet `payment.expired`. Sans effet sur un paiement encore valide.
   */
  async expire(id: string): Promise<{ success: boolean; status?: string; message: string }> {
    return this.client.request('POST', `/v1/payments/${encodeURIComponent(id)}/expire`);
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
   * Créer un lien de paiement.
   *
   * Un montant (`fixed_amount` ou `price`) sans `amount_mode` crée un lien à
   * prix fixe : l'API, elle, retombe sur OPEN (montant libre) si le mode manque.
   */
  async create(params: CreatePaymentLinkParams): Promise<PaymentLink> {
    const amount = params.fixed_amount ?? params.price;
    const body: Record<string, unknown> = {
      ...params,
      amount_mode: params.amount_mode ?? (amount != null ? 'FIXED' : 'OPEN'),
    };
    const response = await this.client.request('POST', '/v1/payment-links', body);
    return withLinkUrl(response.data);
  }

  /**
   * Lister les liens de paiement
   */
  async list(): Promise<PaymentLink[]> {
    const response = await this.client.request('GET', '/v1/payment-links');
    const links = response.data || [];
    return links.map(withLinkUrl);
  }

  /**
   * Récupérer un lien public par slug (sans clé côté API).
   */
  async retrieve(slug: string): Promise<PaymentLink> {
    const response = await this.client.request('GET', `/v1/payment-links/${encodeURIComponent(slug)}`);
    return withLinkUrl(response.data);
  }

  /**
   * Récupérer un de vos liens par son id (authentifié).
   */
  async retrieveById(id: string): Promise<PaymentLink> {
    const response = await this.client.request('GET', `/v1/payment-links/by-id/${encodeURIComponent(id)}`);
    return withLinkUrl(response.data);
  }

  /**
   * Modifier un lien (nom, description, bornes du montant libre, URL de retour, activation).
   */
  async update(id: string, params: UpdatePaymentLinkParams): Promise<PaymentLink> {
    const response = await this.client.request('PATCH', `/v1/payment-links/${encodeURIComponent(id)}`, params);
    return withLinkUrl(response.data);
  }

  /**
   * Supprimer un lien : archivage définitif (paiements et reçus conservés,
   * l'URL publique répond 410).
   */
  async delete(id: string): Promise<any> {
    const response = await this.client.request('DELETE', `/v1/payment-links/${encodeURIComponent(id)}`);
    return response.data;
  }

  /**
   * Désactiver un lien
   */
  async deactivate(id: string): Promise<PaymentLink> {
    const response = await this.client.request('PATCH', `/v1/payment-links/${encodeURIComponent(id)}/deactivate`);
    return withLinkUrl(response.data);
  }

  async activate(id: string): Promise<PaymentLink> {
    const response = await this.client.request('PATCH', `/v1/payment-links/${encodeURIComponent(id)}/activate`);
    return withLinkUrl(response.data);
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
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', '/v1/billing/plans', body, billingOptions(idempotency_key));
    return response.data;
  }

  /**
   * Lister tous les plans
   * GET /v1/billing/plans
   */
  async list(params: ListPlansParams = {}): Promise<Plan[]> {
    return (await this.listPage(params)).plans;
  }

  /** Preserve list()'s array return while exposing cursor metadata. */
  async listPage(params: ListPlansParams = {}): Promise<{ plans: Plan[]; pagination?: CursorPagination }> {
    const response = await this.client.request('GET', `/v1/billing/plans${toQuery({ ...params })}`);
    return { plans: response.data || [], pagination: response.pagination };
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
  async sendLink(id: string, params: CustomerIdentity & { idempotency_key?: string }): Promise<SendPlanLinkResult> {
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', `/v1/billing/plans/${encodeURIComponent(id)}/send-link`, body, billingOptions(idempotency_key));
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

function billingOptions(key?: string): { headers?: Record<string, string> } {
  return key !== undefined ? { headers: { 'X-Idempotency-Key': key } } : {};
}

class SubscriptionsAPI {
  constructor(private client: SahelPayClient) {}

  /** Schedule billing. ACTIVE alone is not evidence of payment. */
  async create(params: CreateSubscriptionParams): Promise<Subscription> {
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', '/v1/billing/subscriptions', body, billingOptions(idempotency_key));
    return response.data;
  }

  async retrieve(id: string): Promise<SubscriptionSnapshot> {
    return (await this.client.request('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`)).data;
  }

  /** Requires an already registered key scoped to this application/mode. No sends or writes. */
  async previewReminder(applicationId: string, subscriptionId: string): Promise<ReminderPreview> {
    return (await this.client.request('GET', `/v1/billing/applications/${encodeURIComponent(applicationId)}/subscriptions/${encodeURIComponent(subscriptionId)}/reminder-preview`)).data;
  }

  async list(params: ListSubscriptionsParams = {}): Promise<{ subscriptions: Subscription[]; pagination: CursorPagination }> {
    return (await this.client.request('GET', `/v1/billing/subscriptions${toQuery({ ...params })}`)).data;
  }

  async cancel(id: string): Promise<{ success: boolean }> {
    return this.client.request('DELETE', `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  }

  /** Trials return invoice=null and payment_link=null. */
  async createWithPayment(params: CreateSubscriptionWithPaymentParams): Promise<CreateSubscriptionWithPaymentResult> {
    const { idempotency_key, ...body } = params;
    return (await this.client.request('POST', '/v1/billing/subscriptions/with-payment', body, billingOptions(idempotency_key))).data;
  }

  /** Import a current paid period or trial. Requires an application API key. */
  async import(params: ImportSubscriptionParams): Promise<SubscriptionSnapshot> {
    const { idempotency_key, ...body } = params;
    return (await this.client.request('POST', '/v1/billing/subscriptions/import', body, billingOptions(idempotency_key))).data;
  }
}

class InvoicesAPI {
  constructor(private client: SahelPayClient) {}

  async create(params: CreateInvoiceParams): Promise<Invoice> {
    const { idempotency_key, ...body } = params;
    return (await this.client.request('POST', '/v1/billing/invoices', body, billingOptions(idempotency_key))).data;
  }

  /** Invoice pagination lives outside data in the API response. */
  async list(params: ListInvoicesParams = {}): Promise<{ invoices: Invoice[]; pagination: InvoicePagination }> {
    const response = await this.client.request('GET', `/v1/billing/invoices${toQuery({ ...params })}`);
    return { invoices: response.data, pagination: response.pagination };
  }

  async retrieve(id: string): Promise<Invoice> {
    return (await this.client.request('GET', `/v1/billing/invoices/${encodeURIComponent(id)}`)).data;
  }

  async open(id: string): Promise<Invoice> {
    return (await this.client.request('PATCH', `/v1/billing/invoices/${encodeURIComponent(id)}/open`)).data;
  }

  async void(id: string): Promise<Invoice> {
    return (await this.client.request('PATCH', `/v1/billing/invoices/${encodeURIComponent(id)}/void`)).data;
  }

  async generatePaymentLink(id: string): Promise<InvoicePaymentLinkResult> {
    return (await this.client.request('POST', `/v1/billing/invoices/${encodeURIComponent(id)}/payment-link`)).data;
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
  async list(params?: ListCustomersParams): Promise<{ customers: Customer[]; pagination: PagePagination }> {
    const response = await this.client.request('GET', `/v1/billing/customers${toQuery({ ...params })}`);
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
   * Historique des livraisons (paginé).
   */
  async listLogs(params: {
    page?: number;
    limit?: number;
    status?: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
    event_type?: string;
    application_id?: string;
    endpoint_id?: string;
  } = {}): Promise<any> {
    const response = await this.client.request('GET', `/v1/webhooks/logs${toQuery(params)}`);
    return response.data;
  }

  /** Détail d'une livraison. */
  async retrieveLog(id: string): Promise<any> {
    const response = await this.client.request('GET', `/v1/webhooks/logs/${encodeURIComponent(id)}`);
    return response.data;
  }

  /** Relancer une livraison échouée (10 par minute). */
  async retry(logId: string): Promise<any> {
    const response = await this.client.request('POST', `/v1/webhooks/logs/${encodeURIComponent(logId)}/retry`);
    return response.data;
  }

  /** Statistiques de livraison. */
  async stats(params: { application_id?: string } = {}): Promise<any> {
    const response = await this.client.request('GET', `/v1/webhooks/stats${toQuery(params)}`);
    return response.data;
  }

  /**
   * Derniers événements émis (clé de test uniquement : 403 en live).
   */
  async listEvents(params: { after?: string; limit?: number; application_id?: string } = {}): Promise<any> {
    const response = await this.client.request('GET', `/v1/webhooks/events${toQuery(params)}`);
    return response.data;
  }

  /** Un événement par son id (`evt_...`). */
  async retrieveEvent(eventId: string): Promise<any> {
    const response = await this.client.request('GET', `/v1/webhooks/events/${encodeURIComponent(eventId)}`);
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

    // Seul le format t=...,v1=... est émis par SahelPay. Un HMAC nu du corps
    // (ancien format, sans horodatage) n'offre aucune protection contre le rejeu.
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

// ==================== SECURE ORDERS (paiement à la livraison) ====================

export type SecureOrderStatus =
  | 'CREATED'
  | 'PAID_HELD'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CANCELLED';

export interface CreateSecureOrderParams {
  /** Montant en XOF (entier). */
  amount: number;
  /** Description visible par l'acheteur (2 à 200 caractères). */
  description: string;
  /** Téléphone de l'acheteur (8 à 15 chiffres, + facultatif). */
  customer_phone: string;
  customer_name?: string;
  /** Délai de livraison après paiement, en heures (défaut 72). */
  delivery_deadline_hours?: number;
  /** Votre référence de commande (64 caractères max). */
  client_reference?: string;
  /** Rejeu sûr de la création (en-tête X-Idempotency-Key). */
  idempotency_key?: string;
}

/**
 * Paiement sécurisé : les fonds restent en séquestre jusqu'à la confirmation
 * de livraison par le code à 6 chiffres de l'acheteur. Fonction activée par
 * marchand : sans activation, l'API répond 404 SECURE_ORDERS_DISABLED.
 */
class SecureOrdersAPI {
  constructor(private client: SahelPayClient) {}

  async create(params: CreateSecureOrderParams): Promise<any> {
    const { idempotency_key, ...body } = params;
    const response = await this.client.request('POST', '/v1/secure-orders', body, {
      headers: { 'X-Idempotency-Key': await generateIdempotencyKey(idempotency_key) },
    });
    return response.data;
  }

  async list(params: { status?: SecureOrderStatus; search?: string; page?: number; limit?: number } = {}): Promise<any> {
    const response = await this.client.request('GET', `/v1/secure-orders${toQuery(params)}`);
    return response.data;
  }

  async retrieve(id: string): Promise<any> {
    const response = await this.client.request('GET', `/v1/secure-orders/${encodeURIComponent(id)}`);
    return response.data;
  }

  /** Annuler une commande avant paiement. */
  async cancel(id: string, params: { reason?: string } = {}): Promise<any> {
    const response = await this.client.request('POST', `/v1/secure-orders/${encodeURIComponent(id)}/cancel`, params);
    return response.data;
  }

  /** Confirmer la livraison avec le code communiqué par l'acheteur : libère les fonds. */
  async confirmDelivery(id: string, code: string): Promise<any> {
    const response = await this.client.request('POST', `/v1/secure-orders/${encodeURIComponent(id)}/confirm-delivery`, { code });
    return response.data;
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
        'User-Agent': `SahelPay-SDK/${SDK_VERSION}`,
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
  };
  /**
   * Toujours true : le compte s'active par le lien envoyé par e-mail. Aucune
   * clé API n'est renvoyée ici ; elles se lisent ensuite dans le dashboard.
   */
  email_verification_required: boolean;
  email_sent?: boolean;
  email_verification_expires_at?: string;
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
  /**
   * La clé secrète n'est jamais renvoyée en clair : seulement un aperçu
   * (`sk_test_****ABCD`). Révélez-la depuis le dashboard.
   */
  api_keys: {
    public_key: string;
    secret_key_preview: string | null;
  };
  onboarding_required?: boolean;
  onboarding_complete?: boolean;
  onboarding_step?: number;
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
 * // Le compte s'active par le lien reçu par e-mail. Aucune clé secrète
 * // n'est renvoyée par l'API : copiez-la depuis le dashboard, puis
 * const sahelpay = new SahelPay({ secretKey: process.env.SAHELPAY_SECRET_KEY! });
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
        'User-Agent': `SahelPay-SDK/${SDK_VERSION}`,
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
        'User-Agent': `SahelPay-SDK/${SDK_VERSION}`,
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
  public invoices: InvoicesAPI;
  public customers: CustomersAPI;
  public portal: PortalAPI;
  public secureOrders: SecureOrdersAPI;

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
    this.invoices = new InvoicesAPI(this.client);
    this.customers = new CustomersAPI(this.client);
    this.portal = new PortalAPI(this.client);
    this.secureOrders = new SecureOrdersAPI(this.client);
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
   * // result.email_verification_required === true : activez le compte par
   * // e-mail, puis copiez la clé secrète depuis le dashboard.
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
