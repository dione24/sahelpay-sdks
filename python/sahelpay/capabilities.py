"""
SahelPay SDK – Capability Matrix (Officielle)

Version: v1.0
Scope: Payment SDK – Multi-Providers
Principe: Toutes les fonctionnalités ne sont pas garanties par tous les providers.

⚠️ IMPORTANT: La disponibilité des fonctionnalités dépend du provider sélectionné.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum


class Provider(str, Enum):
    """Providers supportés par SahelPay"""
    ORANGE_MONEY = "ORANGE_MONEY"
    WAVE = "WAVE"
    MOOV = "MOOV"
    VISA = "VISA"


class Capability(str, Enum):
    """Capabilities disponibles"""
    PAYMENTS = "payments"
    PAYMENT_LINKS = "payment_links"
    QR_CODE = "qr_code"
    PAYOUTS = "payouts"
    WITHDRAWALS = "withdrawals"
    OPR = "opr"
    SPLITS = "splits"
    CUSTOMER_PORTAL = "customer_portal"


@dataclass
class ProviderCapabilities:
    """Capabilities d'un provider"""
    payments: bool
    payment_links: bool
    qr_code: bool
    payouts: bool
    withdrawals: bool
    opr: bool
    splits: bool
    customer_portal: bool


# Capability Matrix officielle
CAPABILITIES: Dict[Provider, ProviderCapabilities] = {
    Provider.ORANGE_MONEY: ProviderCapabilities(
        payments=True,           # WebPay redirect + OTP
        payment_links=True,      # Via wrapper SahelPay
        qr_code=False,           # Pas de QR natif Orange
        payouts=False,           # Non supporté par Orange WebPay
        withdrawals=False,       # Non supporté
        opr=False,               # Pas de request-to-pay API
        splits=False,            # Pas de split natif
        customer_portal=False,   # Hors périmètre Orange
    ),

    Provider.WAVE: ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=True,            # QR natif Wave
        payouts=True,            # Wave Payout API
        withdrawals=True,        # Wave Cash-out
        opr=True,                # Request-to-pay supporté
        splits=False,
        customer_portal=False,
    ),

    Provider.MOOV: ProviderCapabilities(
        payments=True,
        payment_links=False,     # Pas de liens natifs
        qr_code=False,
        payouts=False,           # En développement
        withdrawals=False,
        opr=False,
        splits=False,
        customer_portal=False,
    ),

    Provider.VISA: ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=False,
        payouts=True,            # Card disbursement
        withdrawals=True,
        opr=False,
        splits=True,             # Marketplace splits
        customer_portal=True,    # Saved cards portal
    ),
}


# Justifications officielles (audit-proof)
CAPABILITY_JUSTIFICATIONS: Dict[Provider, Dict[Capability, str]] = {
    Provider.ORANGE_MONEY: {
        Capability.PAYMENTS: "Orange Web Payment API (session + redirect + notif)",
        Capability.PAYMENT_LINKS: "Généré par SahelPay, Orange est destination",
        Capability.QR_CODE: "Orange WebPay ne génère pas de QR",
        Capability.PAYOUTS: "Aucune API payout exposée par Orange",
        Capability.WITHDRAWALS: "Pas de cash-out API disponible",
        Capability.OPR: "Pas de request-to-pay dans Orange WebPay",
        Capability.SPLITS: "Gestion interne SahelPay uniquement",
        Capability.CUSTOMER_PORTAL: "Hors périmètre Orange WebPay",
    },
    Provider.WAVE: {
        Capability.PAYMENTS: "Wave Business API - Payment collection",
        Capability.PAYMENT_LINKS: "Wave Payment Links API",
        Capability.QR_CODE: "Wave QR Code natif",
        Capability.PAYOUTS: "Wave Payout API",
        Capability.WITHDRAWALS: "Wave Cash-out API",
        Capability.OPR: "Wave Request-to-Pay",
        Capability.SPLITS: "Non disponible nativement",
        Capability.CUSTOMER_PORTAL: "Non disponible",
    },
    Provider.MOOV: {
        Capability.PAYMENTS: "Moov Money USSD/Push API",
        Capability.PAYMENT_LINKS: "Non supporté par Moov",
        Capability.QR_CODE: "Non disponible",
        Capability.PAYOUTS: "En cours de développement",
        Capability.WITHDRAWALS: "Non disponible",
        Capability.OPR: "Non disponible",
        Capability.SPLITS: "Non disponible",
        Capability.CUSTOMER_PORTAL: "Non disponible",
    },
    Provider.VISA: {
        Capability.PAYMENTS: "3DS Secure Checkout",
        Capability.PAYMENT_LINKS: "Hosted Payment Page",
        Capability.QR_CODE: "Non applicable aux cartes",
        Capability.PAYOUTS: "Visa Direct / Card Disbursement",
        Capability.WITHDRAWALS: "Bank transfer",
        Capability.OPR: "Non applicable",
        Capability.SPLITS: "Marketplace / Platform payments",
        Capability.CUSTOMER_PORTAL: "Saved cards management",
    },
}


def has_capability(provider: str, capability: str) -> bool:
    """
    Vérifier si un provider supporte une capability

    Args:
        provider: Nom du provider (ORANGE_MONEY, WAVE, etc.)
        capability: Nom de la capability (payments, payouts, etc.)

    Returns:
        True si le provider supporte la capability
    """
    try:
        p = Provider(provider)
        caps = CAPABILITIES.get(p)
        if not caps:
            return False
        return getattr(caps, capability, False)
    except (ValueError, AttributeError):
        return False


def get_capabilities(provider: str) -> Optional[ProviderCapabilities]:
    """
    Obtenir toutes les capabilities d'un provider

    Args:
        provider: Nom du provider

    Returns:
        ProviderCapabilities ou None
    """
    try:
        p = Provider(provider)
        return CAPABILITIES.get(p)
    except ValueError:
        return None


def get_justification(provider: str, capability: str) -> str:
    """
    Obtenir la justification d'une capability

    Args:
        provider: Nom du provider
        capability: Nom de la capability

    Returns:
        Justification textuelle
    """
    try:
        p = Provider(provider)
        c = Capability(capability)
        return CAPABILITY_JUSTIFICATIONS.get(p, {}).get(c, "Non documenté")
    except ValueError:
        return "Non documenté"


def get_providers_with_capability(capability: str) -> List[str]:
    """
    Lister les providers supportant une capability

    Args:
        capability: Nom de la capability

    Returns:
        Liste des noms de providers
    """
    result = []
    for provider, caps in CAPABILITIES.items():
        if getattr(caps, capability, False):
            result.append(provider.value)
    return result


class ProviderCapabilityError(Exception):
    """
    Erreur levée quand un provider ne supporte pas une capability

    C'est l'erreur clé qui protège contractuellement et techniquement.
    """

    def __init__(self, provider: str, capability: str):
        self.provider = provider
        self.capability = capability
        self.justification = get_justification(provider, capability)
        self.code = f"{capability.upper()}_NOT_SUPPORTED"

        message = (
            f'Provider "{provider}" does not support "{capability}". '
            f'Reason: {self.justification}'
        )
        super().__init__(message)


def require_capability(provider: str, capability: str) -> None:
    """
    Vérifier qu'un provider supporte une capability, lever une erreur sinon

    Args:
        provider: Nom du provider
        capability: Nom de la capability

    Raises:
        ProviderCapabilityError: Si le provider ne supporte pas la capability
    """
    if not has_capability(provider, capability):
        raise ProviderCapabilityError(provider, capability)
