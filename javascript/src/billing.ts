/** Public Billing contract; dates are ISO 8601 UTC. See contracts/README.md. */
export type PlanInterval = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE';
export type SubscriptionAccessStatus = SubscriptionStatus | 'EXPIRED';
export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOIDED' | 'PAST_DUE';

/** At least one identity is required by the server. Phone is optional. */
export interface CustomerIdentity {
  customer_id?: string;
  customer_phone?: string;
  customer_external_ref?: string;
  customer_email?: string;
  customer_name?: string;
}
export interface IdempotencyParams { idempotency_key?: string }
export interface CreatePlanParams extends IdempotencyParams {
  name: string; amount: number; interval: PlanInterval; description?: string;
}
export interface UpdatePlanParams {
  name?: string; description?: string; amount?: number; is_active?: boolean;
}
export interface Plan {
  id: string; name: string; description?: string | null; amount: number;
  currency: string; interval: PlanInterval; is_active: boolean;
  subscriber_count?: number; created_at: string; application_id?: string | null; livemode?: boolean | null;
}
export interface DeletePlanResult { deleted: boolean; is_active?: boolean; message?: string }
export interface BillingPaymentLink { id: string; url: string; amount: number }
export interface SendPlanLinkResult {
  subscription_id: string; invoice_id: string; payment_link: BillingPaymentLink | null;
  invoice_status?: 'PAID' | 'VOIDED';
  sms_sent: boolean; message: string;
}
export interface CreateSubscriptionParams extends CustomerIdentity, IdempotencyParams {
  plan_id: string; start_date?: string; trial_end?: string;
}
export interface CreateSubscriptionWithPaymentParams extends CustomerIdentity, IdempotencyParams {
  plan_id: string; external_ref?: string; trial_end?: string;
  redirect_url?: string; metadata?: Record<string, unknown>;
}
export interface ImportSubscriptionParams extends IdempotencyParams {
  plan_id: string; external_ref: string; customer_external_ref: string;
  customer_email?: string; customer_name?: string;
  current_period_start: string; current_period_end: string; trial_end?: string; billing_anchor_at?: string;
}
/** Creation/list shape. Some fields are only present in list responses. */
export interface Subscription {
  id: string; plan_id?: string; plan_name?: string; plan_amount?: number;
  application_id?: string | null; livemode?: boolean | null; external_ref?: unknown;
  customer_phone?: string | null; customer_id?: string | null;
  customer?: { name?: string | null; email?: string | null; external_ref?: string | null } | null;
  status: SubscriptionStatus; next_billing_date: string;
  access_status?: SubscriptionAccessStatus; grace_until?: string | null;
  current_period_start: string | null; current_period_end: string | null; trial_end: string | null;
  plan?: { id: string; name: string; amount: number; interval: PlanInterval };
  created_at: string;
}
/** Canonical GET shape is deliberately distinct from create/list. */
export interface SubscriptionSnapshot {
  id: string; external_ref: string | null; livemode: boolean | null; application_id: string | null;
  customer: { id: string; external_ref: string | null; email: string | null } | null;
  plan_id: string; plan: { amount: number; currency: string; interval: PlanInterval };
  status: SubscriptionStatus; updated_at: string;
  /** Added by backend #214; optional while using a previously deployed backend. */
  access_status?: SubscriptionAccessStatus; grace_until?: string | null; billing_anchor_at?: string;
  current_period_start: string | null; current_period_end: string | null; trial_end: string | null;
  next_billing_date: string; past_due_since: string | null;
  payment_url: string | null; invoice_id: string | null;
}
export interface CheckoutSubscription {
  id: string; plan_id: string; status: SubscriptionStatus | (string & {});
  plan_name?: string; plan_amount?: number; customer_phone?: string | null; customer_id?: string | null;
  next_billing_date?: string; current_period_start?: string | null;
  current_period_end?: string | null; trial_end?: string | null; created_at?: string;
}
export interface CreateSubscriptionWithPaymentResult {
  subscription: CheckoutSubscription;
  invoice: { id: string; status?: InvoiceStatus | (string & {}); invoice_number?: string; total?: number; amount_due?: number } | null;
  payment_link: BillingPaymentLink | null;
}
/** Customer profiles are created by subscription/portal flows, not a CRUD API. */
export interface Customer {
  id: string; external_ref: string | null; phone: string | null; application_id?: string | null;
  name?: string | null; email?: string | null; transaction_count: number;
  total_spent: number; last_transaction_at?: string | null; created_at: string;
}
/** Cursor metadata is optional when reading a server predating #215. */
export interface CursorMetadata { take?: number; next_cursor?: string | null; has_more?: boolean }
export interface CursorPagination extends CursorMetadata { total: number }
export interface ListPlansParams { take?: number; cursor?: string }
export interface ListSubscriptionsParams extends ListPlansParams { status?: SubscriptionStatus }
export interface ListCustomersParams extends ListPlansParams { search?: string; page?: number; limit?: number }
export interface PagePagination extends CursorMetadata { total: number; page: number; limit: number; pages: number }
export interface InvoiceLineParams {
  id?: string; description: string; quantity?: number; unit_price: number;
  amount: number; line_type?: string; metadata?: Record<string, unknown>;
}
export interface CreateInvoiceParams extends IdempotencyParams {
  application_id?: string; customer_id?: string; subscription_id?: string;
  subtotal: number; tax_amount?: number; total: number; currency?: string;
  due_date: string; description?: string; notes?: string; metadata?: Record<string, unknown>;
  include_usage?: boolean; usage_period_start?: string; usage_period_end?: string;
  lines: InvoiceLineParams[];
}
export interface InvoicePagination extends CursorMetadata { total: number; limit: number; offset: number }
export interface ListInvoicesParams extends ListPlansParams {
  status?: InvoiceStatus; customer_id?: string; subscription_id?: string; limit?: number; offset?: number;
}
export interface Invoice {
  id: string; invoice_number: string; merchant_id: string; application_id: string | null;
  livemode?: boolean | null; customer_id: string | null; subscription_id: string | null;
  status: InvoiceStatus; subtotal: number; tax_amount: number; total: number;
  amount_paid: number; amount_due: number; currency: string; issue_date: string;
  due_date: string; paid_at: string | null; payment_link_id: string | null; payment_url: string | null;
  description: string | null; notes: string | null; metadata: Record<string, unknown> | null;
  lines: Array<Omit<InvoiceLineParams, 'metadata'> & { id: string; quantity: number; line_type: string; metadata: Record<string, unknown> | null }>;
  payments: Array<{ id: string; amount: number; currency: string; provider: string | null; paid_at: string; transaction_id: string | null; payment_intent_id?: string | null }>;
  created_at: string; updated_at: string; payment_applied?: boolean;
}
export interface InvoicePaymentLinkResult { invoice: Invoice; payment_link_id: string; payment_url: string }
export interface SubscriptionWebhookData {
  subscription_id: string; plan_id: string; plan_name: string; customer_phone: string | null;
  customer_id?: string | null; amount: number; currency: string;
  payment_link_id: string; payment_url: string; invoice_id: string; invoice_number: string;
  billing_date: string; due_date: string; expires_at?: string;
  default_payment_method?: { type: string; phone: string | null } | null;
}
export interface InvoiceCreatedData extends Omit<SubscriptionWebhookData, 'billing_date'> {
  amount_due: number;
  default_payment_method?: { type: string; phone: string | null } | null;
}
export interface InvoicePaidData {
  invoice_id: string; invoice_number?: string; subscription_id?: string | null;
  amount_paid: number; amount_due: number; status: InvoiceStatus;
  transaction_id: string | null; payment_intent_id: string | null; currency: string;
}
export interface SubscriptionRenewedData {
  current_period_start?: string; current_period_end?: string; updated_at?: string; billing_anchor_at?: string;
  subscription_id: string; next_billing_date: string;
  plan_id: string; plan_name: string; customer_phone: string | null;
  invoice_id: string; invoice_number: string; amount: number; currency: string;
}
export interface SubscriptionCancelledData {
  subscription_id: string; plan_id: string; status: 'CANCELLED'; updated_at: string;
  current_period_start: string | null; current_period_end: string | null;
}
export interface BillingEventPayloads {
  'subscription.cancelled': SubscriptionCancelledData;
  'invoice.created': InvoiceCreatedData;
  'subscription.payment_due': SubscriptionWebhookData;
  'invoice.paid': InvoicePaidData;
  'subscription.renewed': SubscriptionRenewedData;
}

/** Read-only rendering. TEST never sends; calling this method never sends in any mode. */
export interface ReminderPreview {
  application_id: string;
  subscription_id: string;
  livemode: boolean;
  mode: 'desactive' | 'simulation' | 'actif';
  owner: 'sahelpay' | 'application' | null;
  eligible: boolean;
  would_send: boolean;
  step: 1 | 5 | null;
  email: { subject: string; html: string; text: string } | null;
  whatsapp: { enabled: false; consent_required: true };
}
