/**
 * SahelPay Merchant SDK - Version simplifiée pour apps marchandes
 * 
 * Ce SDK expose UNIQUEMENT les 3 fonctions nécessaires pour une intégration marchande:
 * - createPayment() : Créer un paiement
 * - getPaymentStatus() : Vérifier le statut d'un paiement
 * - verifyWebhook() : Vérifier la signature d'un webhook
 * 
 * ⚠️ Ce SDK est "idiot-proof":
 * - Pas de logique provider
 * - Pas de calcul de frais
 * - Types clairs et simples
 * 
 * @example
 * ```typescript
 * import { SahelPayMerchant } from '@sahelpay/sdk/merchant';
 * 
 * const sahelpay = new SahelPayMerchant({
 *   secretKey: process.env.SAHELPAY_SECRET_KEY!,
 *   webhookSecret: process.env.SAHELPAY_WEBHOOK_SECRET!,
 * });
 * 
 * // Créer un paiement
 * const payment = await sahelpay.createPayment({
 *   amount: 5000,
 *   orderId: 'order_123',
 *   customerPhone: '+22370000000',
 *   returnUrl: 'https://myapp.com/checkout/return',
 * });
 * 
 * // Rediriger le client
 * redirect(payment.redirectUrl);
 * ```
 */

// Note: Ce SDK nécessite Node.js avec @types/node
// Pour le browser, utilisez la version browser du SDK
declare const require: (module: string) => typeof import('crypto');
const crypto = require('crypto');

// ============================================================================
// TYPES
// ============================================================================

export interface MerchantConfig {
  /** Clé secrète SahelPay (sk_live_xxx ou sk_test_xxx) */
  secretKey: string;
  /** Secret pour vérifier les webhooks */
  webhookSecret?: string;
  /** Environnement (auto-détecté depuis la clé si non spécifié) */
  environment?: 'sandbox' | 'production';
  /** URL de base personnalisée (optionnel) */
  baseUrl?: string;
  /** Timeout en ms (défaut: 30000) */
  timeout?: number;
}

export interface CreatePaymentParams {
  /** Montant en FCFA (min: 100, max: 5,000,000) */
  amount: number;
  /** ID de la commande dans votre système */
  orderId: string;
  /** Numéro de téléphone du client (+223...) */
  customerPhone: string;
  /** URL de retour après paiement */
  returnUrl: string;
  /** Nom du client (optionnel) */
  customerName?: string;
  /** Email du client (optionnel) */
  customerEmail?: string;
  /** Description affichée au client (optionnel) */
  description?: string;
  /** Données personnalisées (optionnel) */
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  /** ID du paiement SahelPay */
  paymentId: string;
  /** Statut actuel */
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  /** Montant */
  amount: number;
  /** Devise */
  currency: string;
  /** URL de redirection vers le checkout SahelPay */
  redirectUrl: string;
  /** Date d'expiration */
  expiresAt?: string;
  /** Date de création */
  createdAt: string;
}

export interface PaymentStatus {
  /** ID du paiement */
  paymentId: string;
  /** Statut actuel */
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  /** Montant */
  amount: number;
  /** Devise */
  currency: string;
  /** Référence provider (si disponible) */
  providerRef?: string;
  /** Date de mise à jour */
  updatedAt: string;
}

export interface WebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'payment.cancelled' | 'payment.expired';
  version: string;
  timestamp: string;
  data: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    provider?: string;
    provider_ref?: string;
    customer_phone?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  };
}

export interface WebhookVerificationResult {
  /** Signature valide */
  valid: boolean;
  /** Payload parsé (si valide) */
  payload?: WebhookPayload;
  /** Message d'erreur (si invalide) */
  error?: string;
}

export class SahelPayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SahelPayError';
  }
}

// ============================================================================
// SDK MERCHANT
// ============================================================================

export class SahelPayMerchant {
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly webhookSecret?: string;
  private readonly timeout: number;

  constructor(config: MerchantConfig) {
    if (!config.secretKey) {
      throw new SahelPayError('secretKey is required', 'CONFIG_ERROR');
    }

    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;
    this.timeout = config.timeout || 30000;

    // Déterminer l'URL de base
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    } else if (config.environment === 'sandbox' || config.secretKey.startsWith('sk_test_')) {
      this.baseUrl = 'https://sandbox.sahelpay.ml';
    } else {
      this.baseUrl = 'https://api.sahelpay.ml';
    }
  }

  // ==========================================================================
  // 1. CREATE PAYMENT
  // ==========================================================================

  /**
   * Créer un paiement
   * 
   * @example
   * ```typescript
   * const payment = await sahelpay.createPayment({
   *   amount: 5000,
   *   orderId: 'order_123',
   *   customerPhone: '+22370000000',
   *   returnUrl: 'https://myapp.com/checkout/return',
   * });
   * 
   * // Rediriger le client vers payment.redirectUrl
   * ```
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    // Validation
    if (params.amount < 100) {
      throw new SahelPayError('Montant minimum: 100 FCFA', 'INVALID_AMOUNT');
    }
    if (params.amount > 5000000) {
      throw new SahelPayError('Montant maximum: 5,000,000 FCFA', 'INVALID_AMOUNT');
    }
    if (!params.orderId) {
      throw new SahelPayError('orderId requis', 'MISSING_ORDER_ID');
    }
    if (!params.customerPhone) {
      throw new SahelPayError('customerPhone requis', 'MISSING_PHONE');
    }
    if (!params.returnUrl) {
      throw new SahelPayError('returnUrl requis', 'MISSING_RETURN_URL');
    }

    // Clé d'idempotence basée sur l'orderId
    const idempotencyKey = `merchant-order-${params.orderId}`;

    const response = await this.request('POST', '/v1/payments', {
      amount: params.amount,
      currency: 'XOF',
      payment_method: 'MOBILE_MONEY',
      country: 'ML',
      customer: {
        phone: params.customerPhone,
        name: params.customerName,
        email: params.customerEmail,
      },
      return_url: params.returnUrl,
      client_reference: params.orderId,
      metadata: {
        ...params.metadata,
        merchant_order_id: params.orderId,
        description: params.description,
      },
    }, {
      'X-Idempotency-Key': idempotencyKey,
    });

    return {
      paymentId: response.data.id,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
      redirectUrl: response.data.redirect_url,
      expiresAt: response.data.expires_at,
      createdAt: response.data.created_at,
    };
  }

  // ==========================================================================
  // 2. GET PAYMENT STATUS
  // ==========================================================================

  /**
   * Vérifier le statut d'un paiement
   * 
   * @example
   * ```typescript
   * const status = await sahelpay.getPaymentStatus('txn_abc123');
   * if (status.status === 'SUCCESS') {
   *   // Paiement confirmé
   * }
   * ```
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!paymentId) {
      throw new SahelPayError('paymentId requis', 'MISSING_PAYMENT_ID');
    }

    const response = await this.request('GET', `/v1/payments/${paymentId}/status`);

    return {
      paymentId: response.data.id,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
      providerRef: response.data.provider_ref,
      updatedAt: response.data.updated_at,
    };
  }

  // ==========================================================================
  // 3. VERIFY WEBHOOK
  // ==========================================================================

  /**
   * Vérifier la signature d'un webhook
   * 
   * @example
   * ```typescript
   * // Dans votre handler webhook
   * const rawBody = await request.text();
   * const signature = request.headers.get('x-sahelpay-signature');
   * 
   * const result = sahelpay.verifyWebhook(rawBody, signature);
   * 
   * if (!result.valid) {
   *   return Response.json({ error: result.error }, { status: 401 });
   * }
   * 
   * const { event, data } = result.payload;
   * // Traiter l'événement...
   * ```
   */
  verifyWebhook(
    rawBody: string,
    signatureHeader: string | null,
    toleranceSeconds: number = 300
  ): WebhookVerificationResult {
    if (!this.webhookSecret) {
      return { valid: false, error: 'webhookSecret not configured' };
    }

    if (!signatureHeader) {
      return { valid: false, error: 'Missing signature header' };
    }

    try {
      // Parser le header: t=timestamp,v1=signature
      const parts: Record<string, string> = {};
      signatureHeader.split(',').forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) parts[key] = value;
      });

      const timestamp = parts['t'];
      const signature = parts['v1'];

      // Fallback: ancien format (signature simple)
      if (!timestamp && !signature && signatureHeader.length === 64) {
        const expected = crypto
          .createHmac('sha256', this.webhookSecret)
          .update(rawBody)
          .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))) {
          return { valid: false, error: 'Invalid signature (legacy)' };
        }

        return { valid: true, payload: JSON.parse(rawBody) };
      }

      if (!timestamp || !signature) {
        return { valid: false, error: 'Invalid signature header format' };
      }

      // Vérifier le timestamp (protection replay)
      const timestampNum = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);

      if (Math.abs(now - timestampNum) > toleranceSeconds) {
        return { valid: false, error: 'Timestamp too old, possible replay attack' };
      }

      // Calculer la signature attendue
      const payload = `${timestamp}.${rawBody}`;
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        return { valid: false, error: 'Invalid signature' };
      }

      return { valid: true, payload: JSON.parse(rawBody) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: message };
    }
  }

  // ==========================================================================
  // PRIVATE: HTTP REQUEST
  // ==========================================================================

  private async request(
    method: string,
    path: string,
    data?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ success: boolean; data: any }> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SahelPay-Merchant-SDK/1.0.0',
      ...extraHeaders,
    };

    const options: RequestInit = {
      method,
      headers,
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
          json.error?.code || 'API_ERROR',
          response.status
        );
      }

      return json;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof SahelPayError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new SahelPayError('Request timeout', 'TIMEOUT', 408);
      }

      throw new SahelPayError(
        error instanceof Error ? error.message : 'Unknown error',
        'NETWORK_ERROR'
      );
    }
  }
}

// Export par défaut
export default SahelPayMerchant;
