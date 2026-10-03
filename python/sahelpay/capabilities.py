"""
SahelPay SDK – Capability Matrix

Orange Money (Mali) est le seul rail de paiement intégré.
Les payouts automatiques sont refusés par la plateforme : utilisez
`withdrawals.create` pour un retrait manuel vers Orange Money.
"""

from typing import Dict, List, Optional, Literal

PaymentMethod = Literal["ORANGE_MONEY"]

# Alias pour compatibilité
Provider = PaymentMethod

Capability = Literal[
    "payments",
    "payment_links",
    "qr_code",
    "payouts",
    "withdrawals",
    "opr",
    "splits",
    "customer_portal",
]


class ProviderCapabilities:
    """Capabilities d'un provider"""

    def __init__(
        self,
        payments: bool,
        payment_links: bool,
        qr_code: bool,
        payouts: bool,
        withdrawals: bool,
        opr: bool,
        splits: bool,
        customer_portal: bool,
    ):
        self.payments = payments
        self.payment_links = payment_links
        self.qr_code = qr_code
        self.payouts = payouts
        self.withdrawals = withdrawals
        self.opr = opr
        self.splits = splits
        self.customer_portal = customer_portal


CAPABILITIES: Dict[PaymentMethod, ProviderCapabilities] = {
    "ORANGE_MONEY": ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=False,
        payouts=False,
        withdrawals=True,
        opr=False,
        splits=False,
        customer_portal=False,
    ),
}

CAPABILITY_DESCRIPTIONS: Dict[PaymentMethod, Dict[Capability, str]] = {
    "ORANGE_MONEY": {
        "payments": "Paiement via Orange Money (Mali)",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non disponible",
        "payouts": "Indisponible — utilisez withdrawals.create (retrait manuel)",
        "withdrawals": "Retrait manuel vers Orange Money (50 000 à 5 000 000 FCFA)",
        "opr": "Non disponible",
        "splits": "Non disponible",
        "customer_portal": "Portail client SahelPay (indépendant du rail)",
    },
}

CAPABILITY_JUSTIFICATIONS = CAPABILITY_DESCRIPTIONS


def has_capability(method: PaymentMethod, capability: Capability) -> bool:
    caps = CAPABILITIES.get(method)
    if not caps:
        return False
    return getattr(caps, capability, False)


def get_capabilities(method: PaymentMethod) -> Optional[ProviderCapabilities]:
    return CAPABILITIES.get(method)


def get_capability_description(method: PaymentMethod, capability: Capability) -> str:
    return CAPABILITY_DESCRIPTIONS.get(method, {}).get(capability, "Non documenté")


def get_justification(method: PaymentMethod, capability: Capability) -> str:
    return get_capability_description(method, capability)


def get_methods_with_capability(capability: Capability) -> List[PaymentMethod]:
    return [
        method
        for method, caps in CAPABILITIES.items()
        if has_capability(method, capability)
    ]


def get_providers_with_capability(capability: Capability) -> List[PaymentMethod]:
    return get_methods_with_capability(capability)
