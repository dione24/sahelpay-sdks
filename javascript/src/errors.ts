/**
 * SahelPay SDK – Erreurs Standards
 * 
 * Erreurs explicites, propres et traçables pour une meilleure DX.
 */

import { Provider, Capability, getJustification } from './capabilities';

/**
 * Erreur de base SahelPay
 */
export class SahelPayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'SahelPayError';
  }
}

/**
 * Erreur d'authentification
 */
export class AuthenticationError extends SahelPayError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Erreur de validation
 */
export class ValidationError extends SahelPayError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

/**
 * Erreur de provider non supporté
 */
export class ProviderNotSupportedError extends SahelPayError {
  constructor(public provider: string) {
    super(
      `Provider "${provider}" is not supported. Available providers: ORANGE_MONEY, WAVE, MOOV, VISA`,
      'PROVIDER_NOT_SUPPORTED',
      400
    );
    this.name = 'ProviderNotSupportedError';
  }
}

/**
 * Erreur de capability non supportée par le provider
 * 
 * C'est l'erreur clé qui protège contractuellement et techniquement.
 */
export class ProviderCapabilityError extends SahelPayError {
  constructor(
    public provider: Provider,
    public capability: Capability
  ) {
    const justification = getJustification(provider, capability);
    super(
      `Provider "${provider}" does not support "${capability}". Reason: ${justification}`,
      `${capability.toUpperCase()}_NOT_SUPPORTED`,
      400
    );
    this.name = 'ProviderCapabilityError';
  }
}

/**
 * Erreur de timeout
 */
export class TimeoutError extends SahelPayError {
  constructor(message: string = 'Request timeout') {
    super(message, 'TIMEOUT', 408);
    this.name = 'TimeoutError';
  }
}

/**
 * Erreur de réseau
 */
export class NetworkError extends SahelPayError {
  constructor(message: string = 'Network error') {
    super(message, 'NETWORK_ERROR', 503);
    this.name = 'NetworkError';
  }
}

/**
 * Erreur de rate limiting
 */
export class RateLimitError extends SahelPayError {
  constructor(public retryAfter?: number) {
    super(
      `Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
    this.name = 'RateLimitError';
  }
}

/**
 * Erreur de ressource non trouvée
 */
export class NotFoundError extends SahelPayError {
  constructor(resource: string, id: string) {
    super(`${resource} "${id}" not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Erreur de conflit (idempotence)
 */
export class ConflictError extends SahelPayError {
  constructor(message: string = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

/**
 * Erreur de paiement échoué
 */
export class PaymentFailedError extends SahelPayError {
  constructor(
    message: string,
    public reference: string,
    public providerCode?: string
  ) {
    super(message, 'PAYMENT_FAILED', 402);
    this.name = 'PaymentFailedError';
  }
}

/**
 * Erreur de payout échoué
 */
export class PayoutFailedError extends SahelPayError {
  constructor(
    message: string,
    public reference: string,
    public providerCode?: string
  ) {
    super(message, 'PAYOUT_FAILED', 402);
    this.name = 'PayoutFailedError';
  }
}

/**
 * Erreur de solde insuffisant
 */
export class InsufficientBalanceError extends SahelPayError {
  constructor(
    public available: number,
    public required: number,
    public currency: string = 'XOF'
  ) {
    super(
      `Insufficient balance. Available: ${available} ${currency}, Required: ${required} ${currency}`,
      'INSUFFICIENT_BALANCE',
      402
    );
    this.name = 'InsufficientBalanceError';
  }
}

/**
 * Codes d'erreur standards
 */
export const ErrorCodes = {
  // Auth
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  INVALID_API_KEY: 'INVALID_API_KEY',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_PHONE: 'INVALID_PHONE',
  
  // Provider
  PROVIDER_NOT_SUPPORTED: 'PROVIDER_NOT_SUPPORTED',
  PAYMENTS_NOT_SUPPORTED: 'PAYMENTS_NOT_SUPPORTED',
  PAYOUTS_NOT_SUPPORTED: 'PAYOUTS_NOT_SUPPORTED',
  WITHDRAWALS_NOT_SUPPORTED: 'WITHDRAWALS_NOT_SUPPORTED',
  QR_CODE_NOT_SUPPORTED: 'QR_CODE_NOT_SUPPORTED',
  OPR_NOT_SUPPORTED: 'OPR_NOT_SUPPORTED',
  
  // Payment
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CANCELLED: 'PAYMENT_CANCELLED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  
  // Payout
  PAYOUT_FAILED: 'PAYOUT_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // Network
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Resource
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
