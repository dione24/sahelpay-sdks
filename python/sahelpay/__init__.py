"""
SahelPay SDK for Python

Intégration simple des paiements Mobile Money en Afrique de l'Ouest

Example:
    >>> import sahelpay
    >>> client = sahelpay.Client(secret_key="sk_live_xxx")
    >>> payment = client.payments.create(
    ...     amount=5000,
    ...     provider="ORANGE_MONEY",
    ...     customer_phone="+22370000000",
    ...     description="Commande #123"
    ... )
    >>> print(payment.reference_id)
"""

__version__ = "1.0.0"
__author__ = "SahelPay"
__email__ = "dev@sahelpay.ml"

from .client import Client
from .exceptions import SahelPayError, APIError, AuthenticationError, ValidationError
from .resources import Payment, PaymentLink
from .capabilities import (
    CAPABILITIES,
    CAPABILITY_JUSTIFICATIONS,
    has_capability,
    get_capabilities,
    get_justification,
    get_providers_with_capability,
    ProviderCapabilities,
)
from .gateway_stream import GatewayStream

__all__ = [
    "Client",
    "SahelPayError",
    "APIError", 
    "AuthenticationError",
    "ValidationError",
    "Payment",
    "PaymentLink",
    "CAPABILITIES",
    "CAPABILITY_JUSTIFICATIONS",
    "has_capability",
    "get_capabilities",
    "get_justification",
    "get_providers_with_capability",
    "ProviderCapabilities",
    "GatewayStream",
]
