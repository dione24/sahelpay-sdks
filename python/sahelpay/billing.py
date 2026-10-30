"""Billing resources. Raw dictionaries preserve nullable fields and API pagination."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal, TypedDict
from urllib.parse import quote, urlencode

PlanInterval = Literal["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]
SubscriptionStatus = Literal["ACTIVE", "PAST_DUE", "CANCELLED", "INCOMPLETE"]
InvoiceStatus = Literal["DRAFT", "OPEN", "PAID", "VOIDED", "PAST_DUE"]

class CustomerIdentity(TypedDict, total=False):
    customer_id: str
    customer_phone: str
    customer_external_ref: str
    customer_email: str
    customer_name: str

class SubscriptionPeriod(TypedDict):
    current_period_start: Optional[str]
    current_period_end: Optional[str]
    trial_end: Optional[str]

class SubscriptionSnapshot(SubscriptionPeriod):
    id: str
    external_ref: Optional[str]
    livemode: Optional[bool]
    application_id: Optional[str]
    customer: Optional[Dict[str, Any]]
    plan_id: str
    plan: Dict[str, Any]
    status: SubscriptionStatus
    updated_at: str
    next_billing_date: str
    past_due_since: Optional[str]
    payment_url: Optional[str]
    invoice_id: Optional[str]

class CheckoutResult(TypedDict):
    subscription: Dict[str, Any]
    invoice: Optional[Dict[str, Any]]
    payment_link: Optional[Dict[str, Any]]

class Customer(TypedDict):
    id: str
    application_id: Optional[str]
    external_ref: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    name: Optional[str]
    transaction_count: int
    total_spent: float
    last_transaction_at: Optional[str]
    created_at: str

class InvoicePaidData(TypedDict):
    invoice_id: str
    invoice_number: str
    subscription_id: Optional[str]
    amount_paid: float
    amount_due: float
    status: InvoiceStatus
    transaction_id: Optional[str]
    payment_intent_id: Optional[str]
    currency: str

class SubscriptionRenewedData(TypedDict):
    subscription_id: str
    next_billing_date: str
    plan_id: str
    plan_name: str
    customer_phone: Optional[str]
    invoice_id: str
    invoice_number: str
    amount: float
    currency: str

class SubscriptionPaymentDueData(TypedDict):
    subscription_id: str
    plan_id: str
    plan_name: str
    customer_phone: Optional[str]
    customer_id: Optional[str]
    amount: float
    currency: str
    payment_link_id: str
    payment_url: str
    invoice_id: str
    invoice_number: str
    billing_date: str
    due_date: str
    default_payment_method: Optional[Dict[str, Any]]

class InvoiceCreatedData(TypedDict):
    invoice_id: str
    invoice_number: str
    subscription_id: str
    plan_id: str
    plan_name: str
    customer_phone: Optional[str]
    customer_id: Optional[str]
    amount: float
    amount_due: float
    currency: str
    payment_link_id: str
    payment_url: str
    due_date: str
    default_payment_method: Optional[Dict[str, Any]]

def _query(params):
    values = {k: v for k, v in params.items() if v is not None}
    return "?" + urlencode(values) if values else ""

def _identity(customer_phone, fields):
    return {k: v for k, v in dict(customer_phone=customer_phone, **fields).items() if v is not None}

class BillingResource:
    def __init__(self, client):
        self._client = client

    def _write(self, method, path, data=None, idempotency_key=None):
        headers = {"X-Idempotency-Key": idempotency_key} if idempotency_key else None
        return self._client._request(method, path, data or {}, headers=headers)

class PlansAPI(BillingResource):
    def create(self, name: str, amount: float, interval: PlanInterval = "MONTHLY",
               description: Optional[str] = None, *, idempotency_key: Optional[str] = None) -> Plan:
        body = dict(name=name, amount=amount, interval=interval)
        if description is not None:
            body["description"] = description
        return self._write("POST", "/v1/billing/plans", body, idempotency_key).get("data", {})

    def list(self) -> List[Plan]:
        return self._client._request("GET", "/v1/billing/plans").get("data", [])

    def update(self, plan_id: str, **fields: Any) -> Dict[str, Any]:
        return self._client._request("PATCH", "/v1/billing/plans/" + quote(plan_id, safe=""), fields)

    def deactivate(self, plan_id: str) -> Dict[str, Any]:
        return self.update(plan_id, is_active=False)

    def delete(self, plan_id: str) -> Dict[str, Any]:
        return self._client._request("DELETE", "/v1/billing/plans/" + quote(plan_id, safe="")).get("data", {})

    def send_link(self, plan_id: str, customer_phone: Optional[str] = None, *,
                  customer_id: Optional[str] = None, customer_external_ref: Optional[str] = None,
                  customer_email: Optional[str] = None, customer_name: Optional[str] = None,
                  idempotency_key: Optional[str] = None) -> Dict[str, Any]:
        body = _identity(customer_phone, dict(customer_id=customer_id, customer_external_ref=customer_external_ref,
                         customer_email=customer_email, customer_name=customer_name))
        return self._write("POST", "/v1/billing/plans/" + quote(plan_id, safe="") + "/send-link", body, idempotency_key).get("data", {})

class SubscriptionsAPI(BillingResource):
    def create(self, plan_id: str, customer_phone: Optional[str] = None, start_date: Optional[str] = None, *,
               customer_id: Optional[str] = None, customer_external_ref: Optional[str] = None,
               customer_email: Optional[str] = None, customer_name: Optional[str] = None,
               trial_end: Optional[str] = None, idempotency_key: Optional[str] = None) -> Subscription:
        body = _identity(customer_phone, dict(plan_id=plan_id, start_date=start_date, trial_end=trial_end,
                         customer_id=customer_id, customer_external_ref=customer_external_ref,
                         customer_email=customer_email, customer_name=customer_name))
        return self._write("POST", "/v1/billing/subscriptions", body, idempotency_key).get("data", {})

    def retrieve(self, subscription_id: str) -> SubscriptionSnapshot:
        return self._client._request("GET", "/v1/billing/subscriptions/" + quote(subscription_id, safe="")).get("data", {})

    def list(self, status: Optional[SubscriptionStatus] = None) -> SubscriptionList:
        return self._client._request("GET", "/v1/billing/subscriptions" + _query(dict(status=status))).get("data", {})

    def cancel(self, subscription_id: str) -> Dict[str, Any]:
        return self._client._request("DELETE", "/v1/billing/subscriptions/" + quote(subscription_id, safe=""))

    def create_with_payment(self, plan_id: str, customer_phone: Optional[str] = None,
                            redirect_url: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None, *,
                            customer_id: Optional[str] = None, customer_external_ref: Optional[str] = None,
                            customer_email: Optional[str] = None, customer_name: Optional[str] = None,
                            trial_end: Optional[str] = None, external_ref: Optional[str] = None,
                            idempotency_key: Optional[str] = None) -> CheckoutResult:
        body = _identity(customer_phone, dict(plan_id=plan_id, redirect_url=redirect_url, metadata=metadata,
                         trial_end=trial_end, external_ref=external_ref, customer_id=customer_id,
                         customer_external_ref=customer_external_ref, customer_email=customer_email, customer_name=customer_name))
        return self._write("POST", "/v1/billing/subscriptions/with-payment", body, idempotency_key).get("data", {})

    def import_period(self, plan_id: str, external_ref: str, customer_external_ref: str,
                      current_period_start: str, current_period_end: str, *, trial_end: Optional[str] = None,
                      customer_email: Optional[str] = None, customer_name: Optional[str] = None,
                      idempotency_key: Optional[str] = None) -> SubscriptionSnapshot:
        body = dict(plan_id=plan_id, external_ref=external_ref, customer_external_ref=customer_external_ref,
                    current_period_start=current_period_start, current_period_end=current_period_end,
                    trial_end=trial_end, customer_email=customer_email, customer_name=customer_name)
        return self._write("POST", "/v1/billing/subscriptions/import", {k:v for k,v in body.items() if v is not None}, idempotency_key).get("data", {})

class CustomersAPI(BillingResource):
    def list(self, search: Optional[str] = None, page: int = 1, limit: int = 20) -> CustomerList:
        return self._client._request("GET", "/v1/billing/customers" + _query(dict(search=search, page=page, limit=limit))).get("data", {})

class InvoicesAPI(BillingResource):
    def create(self, *, subtotal: float, total: float, due_date: str, lines: List[Dict[str, Any]],
               idempotency_key: Optional[str] = None, **fields: Any) -> Invoice:
        body = dict(fields, subtotal=subtotal, total=total, due_date=due_date, lines=lines)
        return self._write("POST", "/v1/billing/invoices", body, idempotency_key).get("data", {})

    def list(self, *, status: Optional[InvoiceStatus] = None, customer_id: Optional[str] = None,
             subscription_id: Optional[str] = None, limit: Optional[int] = None, offset: Optional[int] = None) -> InvoiceList:
        response = self._client._request("GET", "/v1/billing/invoices" + _query(dict(status=status, customer_id=customer_id,
                                        subscription_id=subscription_id, limit=limit, offset=offset)))
        return {"invoices": response.get("data", []), "pagination": response.get("pagination", {})}

    def retrieve(self, invoice_id: str) -> Invoice:
        return self._client._request("GET", "/v1/billing/invoices/" + quote(invoice_id, safe="")).get("data", {})

    def open(self, invoice_id: str) -> Invoice:
        return self._write("PATCH", "/v1/billing/invoices/" + quote(invoice_id, safe="") + "/open").get("data", {})

    def void(self, invoice_id: str) -> Invoice:
        return self._write("PATCH", "/v1/billing/invoices/" + quote(invoice_id, safe="") + "/void").get("data", {})

    def generate_payment_link(self, invoice_id: str) -> Dict[str, Any]:
        return self._write("POST", "/v1/billing/invoices/" + quote(invoice_id, safe="") + "/payment-link").get("data", {})

# Importable annotations for consumers that keep the SDK's dictionary interface.
class _PlanOptional(TypedDict, total=False):
    subscriber_count: int

class Plan(_PlanOptional):
    id: str
    name: str
    description: Optional[str]
    amount: float
    currency: str
    interval: PlanInterval
    is_active: bool
    created_at: str

class InvoiceLine(TypedDict, total=False):
    id: str
    description: str
    quantity: float
    unit_price: float
    amount: float
    line_type: str
    metadata: Optional[Dict[str, Any]]

class Invoice(TypedDict):
    id: str
    invoice_number: str
    merchant_id: str
    application_id: Optional[str]
    livemode: Optional[bool]
    customer_id: Optional[str]
    subscription_id: Optional[str]
    status: InvoiceStatus
    subtotal: float
    tax_amount: float
    total: float
    amount_paid: float
    amount_due: float
    currency: str
    issue_date: str
    due_date: str
    paid_at: Optional[str]
    payment_link_id: Optional[str]
    payment_url: Optional[str]
    description: Optional[str]
    notes: Optional[str]
    metadata: Optional[Dict[str, Any]]
    lines: List[InvoiceLine]
    payments: List[Dict[str, Any]]
    created_at: str
    updated_at: str

class InvoicePaidEvent(TypedDict):
    id: str
    event: Literal['invoice.paid']
    livemode: bool
    timestamp: str
    data: InvoicePaidData

class InvoiceCreatedEvent(TypedDict):
    id: str
    event: Literal['invoice.created']
    livemode: bool
    timestamp: str
    data: InvoiceCreatedData

class SubscriptionPaymentDueEvent(TypedDict):
    id: str
    event: Literal['subscription.payment_due']
    livemode: bool
    timestamp: str
    data: SubscriptionPaymentDueData

class SubscriptionRenewedEvent(TypedDict):
    id: str
    event: Literal['subscription.renewed']
    livemode: bool
    timestamp: str
    data: SubscriptionRenewedData

class SubscriptionPlan(TypedDict):
    id: str
    name: str
    amount: float
    interval: PlanInterval

class SubscriptionCustomer(TypedDict):
    name: Optional[str]
    email: Optional[str]
    external_ref: Optional[str]

class _SubscriptionOptional(TypedDict, total=False):
    plan_id: str
    plan_name: str
    plan: SubscriptionPlan
    customer: Optional[SubscriptionCustomer]

class Subscription(SubscriptionPeriod, _SubscriptionOptional):
    id: str
    customer_phone: Optional[str]
    customer_id: Optional[str]
    status: SubscriptionStatus
    next_billing_date: str
    created_at: str

class SubscriptionList(TypedDict):
    subscriptions: List[Subscription]
    pagination: Dict[str, int]

class InvoiceList(TypedDict):
    invoices: List[Invoice]
    pagination: Dict[str, int]

class CustomerList(TypedDict):
    customers: List[Customer]
    pagination: Dict[str, int]
