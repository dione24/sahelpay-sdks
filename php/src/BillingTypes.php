<?php

declare(strict_types=1);

namespace SahelPay;

/**
 * Static array shapes for the dictionary-based PHP API (PHPStan/Psalm consumers).
 * Nullable fields are preserved by Response::getData and WebhookEvent::getData.
 *
 * @phpstan-type CustomerIdentity array{customer_id?: string, customer_phone?: string, customer_external_ref?: string, customer_email?: string, customer_name?: string}
 * @phpstan-type Plan array{id: string, name: string, amount: int|float, currency: string, interval: 'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY', is_active: bool, created_at: string}
 * @phpstan-type Subscription array{id: string, customer_phone: string|null, customer_id: string|null, status: string, next_billing_date: string, current_period_start: string|null, current_period_end: string|null, trial_end: string|null, created_at: string}
 * @phpstan-type SubscriptionSnapshot array{id: string, external_ref: string|null, livemode: bool|null, application_id: string|null, customer: array{id: string, external_ref: string|null, email: string|null}|null, plan_id: string, plan: array{amount: int|float, currency: string, interval: string}, status: string, updated_at: string, current_period_start: string|null, current_period_end: string|null, trial_end: string|null, next_billing_date: string, past_due_since: string|null, payment_url: string|null, invoice_id: string|null, access_status?: string, grace_until?: string|null, billing_anchor_at?: string}
 * @phpstan-type Invoice array{id: string, invoice_number: string, status: string, subtotal: int|float, total: int|float, amount_paid: int|float, amount_due: int|float, currency: string, due_date: string, paid_at: string|null, payment_url: string|null, lines: array, payments: array, livemode?: bool|null}
 * @phpstan-type Period array{current_period_start: string|null, current_period_end: string|null, trial_end: string|null}
 * @phpstan-type Customer array{id: string, external_ref: string|null, phone: string|null, email: string|null, name: string|null, transaction_count: int, total_spent: int|float, created_at: string}
 * @phpstan-type InvoicePaidData array{invoice_id: string, invoice_number: string, subscription_id: string|null, amount_paid: int|float, amount_due: int|float, status: string, currency: string, transaction_id: string|null, payment_intent_id: string|null}
 * @phpstan-type SubscriptionRenewedData array{subscription_id: string, plan_id: string, plan_name: string, customer_phone: string|null, invoice_id: string, invoice_number: string, next_billing_date: string, amount: int|float, currency: string, current_period_start?: string, current_period_end?: string, updated_at?: string, billing_anchor_at?: string}
 * @phpstan-type SubscriptionCancelledData array{subscription_id: string, plan_id: string, status: 'CANCELLED', updated_at: string, current_period_start: string|null, current_period_end: string|null}
 * @phpstan-type InvoiceCreatedData array{invoice_id: string, invoice_number: string, subscription_id: string, plan_id: string, plan_name: string, customer_phone: string|null, customer_id: string|null, amount: int|float, amount_due: int|float, currency: string, payment_link_id: string, payment_url: string, due_date: string, default_payment_method: array|null}
 * @phpstan-type SubscriptionPaymentDueData array{subscription_id: string, plan_id: string, plan_name: string, customer_phone: string|null, customer_id: string|null, amount: int|float, currency: string, payment_link_id: string, payment_url: string, invoice_id: string, invoice_number: string, billing_date: string, due_date: string, default_payment_method: array|null}
 */
final class BillingTypes
{
    public const PLAN_INTERVALS = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
    public const SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED', 'INCOMPLETE'];
    public const INVOICE_STATUSES = ['DRAFT', 'OPEN', 'PAID', 'VOIDED', 'PAST_DUE'];
}
