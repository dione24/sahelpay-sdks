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

declare const require: any;

export interface SahelPayConfig {
  secretKey: string;
  environment?: 'sandbox' | 'production';
  baseUrl?: string;
  timeout?: number;
}

export interface CreatePaymentParams {
  amount: number;
  currency?: string;
  provider?: string;
  payment_method?: 'MOBILE_MONEY' | 'CARD';
  country?: string;
  customer_phone: string;
  customer_name?: string;
  customer_email?: string;
  description?: string;
  metadata?: Record<string, any>;
  callback_url?: string;
  return_url?: string;
  success_url?: string;
  cancel_url?: string;
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
  amount: number;
  currency: string;
  provider: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
  customer_phone: string;
  description?: string;
  payment_method?: string;
  country?: string;
  provider_ref?: string;
  redirect_url?: string;
  expires_at?: string;
  checkout_url?: string;
  ussd_code?: string;
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
  provider: 'ORANGE_MONEY' | 'WAVE' | 'MOOV';
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

export interface WebhookEvent {
  event: 'payment.success' | 'payment.failed' | 'payment.cancelled' | 'payout.completed' | 'payout.failed' | 'subscription.payment_due' | 'subscription.cancelled';
  data: Payment | Payout | SubscriptionWebhookData;
  timestamp: string;
}

// ==================== PLANS ====================

export interface Plan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'WEEKLY' | 'MONTHLY';
  is_active: boolean;
  subscriber_count?: number;
  created_at: string;
}

export interface CreatePlanParams {
  name: string;
  amount: number;
  interval: 'WEEKLY' | 'MONTHLY';
  description?: string;
}

// ==================== SUBSCRIPTIONS ====================

export interface Subscription {
  id: string;
  plan_id: string;
  plan_name?: string;
  customer_phone: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
  next_billing_date: string;
  retry_count: number;
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

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreateCustomerParams {
  phone: string;
  name?: string;
  email?: string;
  metadata?: Record<string, any>;
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
    const inferredPaymentMethod: CreatePaymentParams['payment_method'] =
      params.payment_method ||
      (provider && ['CARD', 'CINETPAY', 'GIM_UEMOA', 'VISA', 'MASTERCARD'].includes(provider) ? 'CARD' : undefined);

    const isCard = inferredPaymentMethod === 'CARD';
    if (isCard) {
      if (!params.customer_name) {
        throw new SahelPayError('CinetPay CREDIT_CARD requires customerName', 'VALIDATION_ERROR', 400);
      }
      if (!params.customer_email) {
        throw new SahelPayError('CinetPay CREDIT_CARD requires customerEmail', 'VALIDATION_ERROR', 400);
      }
      if (!params.customer_phone) {
        throw new SahelPayError('CinetPay CREDIT_CARD requires customerPhone', 'VALIDATION_ERROR', 400);
      }
    }

    const response = await this.client.request('POST', '/v1/payments', {
      amount: params.amount,
      currency: params.currency || 'XOF',
      provider,
      payment_method: inferredPaymentMethod,
      country: params.country,
      customer_phone: params.customer_phone,
      customer_name: params.customer_name,
      customer_email: params.customer_email,
      metadata: {
        ...(params.metadata || {}),
        ...(params.description ? { description: params.description } : {}),
      },
      return_url: params.return_url,
      success_url: params.success_url,
      cancel_url: params.cancel_url,
      hosted_checkout: params.hosted_checkout ?? true,
    });

    const data = response.data;
    return {
      id: data.id,
      reference_id: data.id,
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
      expires_at: data.expires_at,
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
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
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

          if (['SUCCESS', 'FAILED', 'CANCELLED'].includes(status)) {
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
    amount: number;
    recipient_phone: string;
    recipient_name?: string;
    description?: string;
  }): Promise<Withdrawal> {
    const response = await this.client.request('POST', '/v1/withdrawals', params);
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

// ==================== PLANS API ====================

class PlansAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouveau plan d'abonnement
   */
  async create(params: CreatePlanParams): Promise<Plan> {
    const response = await this.client.request('POST', '/v1/plans', params);
    return response.data;
  }

  /**
   * Lister tous les plans
   */
  async list(): Promise<Plan[]> {
    const response = await this.client.request('GET', '/v1/plans');
    return response.data || [];
  }

  /**
   * Récupérer un plan par ID
   */
  async retrieve(id: string): Promise<Plan> {
    const response = await this.client.request('GET', `/v1/plans/${id}`);
    return response.data;
  }

  /**
   * Désactiver un plan
   */
  async deactivate(id: string): Promise<Plan> {
    const response = await this.client.request('PATCH', `/v1/plans/${id}/deactivate`);
    return response.data;
  }

  /**
   * Supprimer un plan
   */
  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/v1/plans/${id}`);
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
    const response = await this.client.request('POST', '/v1/subscriptions', params);
    return response.data;
  }

  /**
   * Lister tous les abonnements
   */
  async list(params?: { 
    plan_id?: string; 
    status?: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';
    limit?: number;
  }): Promise<{ subscriptions: Subscription[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.plan_id) query.set('plan_id', params.plan_id);
    if (params?.status) query.set('status', params.status);
    if (params?.limit) query.set('limit', params.limit.toString());

    const response = await this.client.request('GET', `/v1/subscriptions?${query.toString()}`);
    return response.data;
  }

  /**
   * Récupérer un abonnement par ID
   */
  async retrieve(id: string): Promise<Subscription> {
    const response = await this.client.request('GET', `/v1/subscriptions/${id}`);
    return response.data;
  }

  /**
   * Annuler un abonnement
   */
  async cancel(id: string): Promise<{ success: boolean }> {
    const response = await this.client.request('DELETE', `/v1/subscriptions/${id}`);
    return response;
  }
}

// ==================== CUSTOMERS API ====================

class CustomersAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Créer un nouveau client
   */
  async create(params: CreateCustomerParams): Promise<Customer> {
    const response = await this.client.request('POST', '/v1/customers', params);
    return response.data;
  }

  /**
   * Lister tous les clients
   */
  async list(params?: { limit?: number; offset?: number }): Promise<{ customers: Customer[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const response = await this.client.request('GET', `/v1/customers?${query.toString()}`);
    return response.data;
  }

  /**
   * Récupérer un client par ID
   */
  async retrieve(id: string): Promise<Customer> {
    const response = await this.client.request('GET', `/v1/customers/${id}`);
    return response.data;
  }

  /**
   * Mettre à jour un client
   */
  async update(id: string, params: Partial<CreateCustomerParams>): Promise<Customer> {
    const response = await this.client.request('PATCH', `/v1/customers/${id}`, params);
    return response.data;
  }

  /**
   * Supprimer un client
   */
  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/v1/customers/${id}`);
  }
}

// ==================== PORTAL API ====================

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

class WebhooksAPI {
  constructor(private client: SahelPayClient) {}

  /**
   * Vérifier la signature d'un webhook
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    // Implémentation HMAC-SHA256
    if (typeof window === 'undefined') {
      // Node.js
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
      return signature === expectedSignature;
    } else {
      // Browser - utiliser SubtleCrypto
      console.warn('Webhook verification should be done server-side');
      return false;
    }
  }

  /**
   * Parser un événement webhook
   */
  parseEvent(payload: string, signature: string, secret: string): WebhookEvent {
    if (!this.verifySignature(payload, signature, secret)) {
      throw new Error('Invalid webhook signature');
    }
    return JSON.parse(payload);
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
      this.baseUrl = 'https://sandbox.sahelpay.ml';
    } else {
      this.baseUrl = 'https://api.sahelpay.ml';
    }
  }

  async request(method: string, path: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'SahelPay-SDK/1.0.0',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    options.signal = controller.signal;

    try {
      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok) {
        throw new SahelPayError(
          json.error?.message || 'API Error',
          json.error?.code || 'UNKNOWN_ERROR',
          response.status
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

export class SahelPayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'SahelPayError';
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
  public payouts: PayoutsAPI;
  public withdrawals: WithdrawalsAPI;
  public webhooks: WebhooksAPI;
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
    this.plans = new PlansAPI(this.client);
    this.subscriptions = new SubscriptionsAPI(this.client);
    this.customers = new CustomersAPI(this.client);
    this.portal = new PortalAPI(this.client);
  }
}

// Garder l'import default: import SahelPay from "@sahelpay/sdk"
export default SahelPay;
