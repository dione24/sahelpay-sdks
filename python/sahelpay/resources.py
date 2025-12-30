"""
Ressources SahelPay (Payment, PaymentLink, etc.)
"""

from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime


@dataclass
class Payment:
    """Représente un paiement SahelPay"""

    id: str
    reference_id: str
    amount: float
    currency: str
    provider: str
    status: str
    customer_phone: str
    client_reference: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    country: Optional[str] = None
    provider_ref: Optional[str] = None
    redirect_url: Optional[str] = None
    expires_at: Optional[str] = None
    checkout_url: Optional[str] = None
    ussd_code: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    fee_calculation: Optional[Dict[str, Any]] = None
    ledger_entries: Optional[List[Dict[str, Any]]] = None
    provider_events: Optional[List[Dict[str, Any]]] = None
    gateway_used: Optional[str] = None
    routing_reason: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Payment":
        payment_id = data.get("id", "")
        reference_id = data.get("reference_id") or data.get("reference") or payment_id
        return cls(
            id=payment_id,
            reference_id=reference_id,
            amount=float(data.get("amount", 0)),
            currency=data.get("currency", "XOF"),
            provider=data.get("provider") or data.get("payment_method", ""),
            status=data.get("status", "PENDING"),
            customer_phone=data.get("customer_phone") or (data.get("metadata") or {}).get("customer", {}).get("phone") or "",
            client_reference=data.get("client_reference"),
            description=data.get("description") or (data.get("metadata") or {}).get("description"),
            payment_method=data.get("payment_method"),
            country=data.get("country"),
            provider_ref=data.get("provider_ref"),
            redirect_url=data.get("redirect_url"),
            expires_at=data.get("expires_at"),
            checkout_url=data.get("checkout_url"),
            ussd_code=data.get("ussd_code"),
            metadata=data.get("metadata"),
            fee_calculation=data.get("fee_calculation"),
            ledger_entries=data.get("ledger_entries"),
            provider_events=data.get("provider_events"),
            gateway_used=data.get("gateway_used"),
            routing_reason=data.get("routing_reason"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def is_successful(self) -> bool:
        return self.status == "SUCCESS"

    def is_pending(self) -> bool:
        return self.status == "PENDING"

    def is_failed(self) -> bool:
        return self.status == "FAILED"


@dataclass
class PaymentLink:
    """Représente un lien de paiement"""

    id: str
    title: str
    price: float
    currency: str
    slug: str
    url: str
    is_active: bool
    redirect_url: Optional[str] = None
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaymentLink":
        slug = data.get("slug", "")
        url = data.get("url") or (f"https://pay.sahelpay.ml/{slug}" if slug else "")
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            price=float(data.get("price", 0)),
            currency=data.get("currency", "XOF"),
            slug=slug,
            url=url,
            is_active=data.get("is_active", True),
            redirect_url=data.get("redirect_url"),
            created_at=data.get("created_at"),
        )


@dataclass
class Payout:
    """Représente un payout (envoi d'argent)"""

    id: str
    reference: str
    amount: float
    fee: float
    net_amount: float
    currency: str
    provider: str
    recipient_phone: str
    status: str
    type: str = "OTHER"
    recipient_name: Optional[str] = None
    description: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    completed_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Payout":
        return cls(
            id=data.get("id", ""),
            reference=data.get("reference", ""),
            amount=float(data.get("amount", 0)),
            fee=float(data.get("fee", 0)),
            net_amount=float(data.get("net_amount", 0)),
            currency=data.get("currency", "XOF"),
            provider=data.get("provider", ""),
            recipient_phone=data.get("recipient_phone", ""),
            status=data.get("status", "PENDING"),
            type=data.get("type", "OTHER"),
            recipient_name=data.get("recipient_name"),
            description=data.get("description"),
            error_message=data.get("error_message"),
            created_at=data.get("created_at"),
            completed_at=data.get("completed_at"),
        )

    def is_completed(self) -> bool:
        return self.status == "COMPLETED"

    def is_pending(self) -> bool:
        return self.status in ("PENDING", "PROCESSING")

    def is_failed(self) -> bool:
        return self.status == "FAILED"


@dataclass
class Refund:
    """Représente un remboursement SahelPay"""

    id: str
    payment_id: str
    amount: float
    currency: str
    status: str
    reason: Optional[str] = None
    client_reference: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Refund":
        return cls(
            id=data.get("id", ""),
            payment_id=data.get("payment_id", ""),
            amount=float(data.get("amount", 0)),
            currency=data.get("currency", "XOF"),
            status=data.get("status", "PENDING"),
            reason=data.get("reason"),
            client_reference=data.get("client_reference"),
            metadata=data.get("metadata"),
            created_at=data.get("created_at"),
        )


@dataclass
class PayoutStats:
    """Statistiques des payouts"""

    total: int
    completed: int
    failed: int
    pending: int
    success_rate: float
    total_volume: float

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PayoutStats":
        return cls(
            total=int(data.get("total", 0)),
            completed=int(data.get("completed", 0)),
            failed=int(data.get("failed", 0)),
            pending=int(data.get("pending", 0)),
            success_rate=float(data.get("success_rate", 0)),
            total_volume=float(data.get("total_volume", 0)),
        )


@dataclass
class WebhookEvent:
    """Représente un événement webhook"""

    event: str
    data: Any  # Can be Payment or Payout
    timestamp: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WebhookEvent":
        event_type = data.get("event", "")
        event_data = data.get("data", {})
        
        # Parse data based on event type
        if "payout" in event_type:
            parsed_data = Payout.from_dict(event_data)
        elif "refund" in event_type:
            parsed_data = Refund.from_dict(event_data)
        else:
            parsed_data = Payment.from_dict(event_data)
        
        return cls(
            event=event_type,
            data=parsed_data,
            timestamp=data.get("timestamp", ""),
        )

