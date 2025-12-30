"""
SahelPay SDK – Capability Matrix

Définit les fonctionnalités disponibles pour chaque MÉTHODE DE PAIEMENT.

⚠️ Le routing interne (INTOUCH, CINETPAY, ORANGE_DIRECT, etc.) est TRANSPARENT.
SahelPay choisit automatiquement le meilleur gateway selon le coût et la disponibilité.

Le client ne voit que les méthodes de paiement, pas les gateways internes.
"""

from typing import Dict, List, Optional, Literal

PaymentMethod = Literal[
    "ORANGE_MONEY",   # Orange Money (Mali, Sénégal, CI...)
    "WAVE",           # Wave (Sénégal, Mali, CI)
    "MOOV",           # Moov Money (Mali, Bénin, Togo)
    "CARD",           # Carte bancaire (VISA/Mastercard/GIM-UEMOA)
    "VISA",           # Carte VISA
    "MASTERCARD",     # Carte Mastercard
    "GIM_UEMOA",      # Carte régionale GIM-UEMOA
]

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


"""
Capability Matrix

Définit ce que chaque MÉTHODE DE PAIEMENT supporte du point de vue client.
Le routing interne (via quel gateway) est transparent et géré par SahelPay.
"""
CAPABILITIES: Dict[PaymentMethod, ProviderCapabilities] = {
    # Orange Money - routing auto vers ORANGE_DIRECT ou INTOUCH
    "ORANGE_MONEY": ProviderCapabilities(
        payments=True,           # Paiement mobile
        payment_links=True,      # Liens de paiement
        qr_code=False,           # Pas de QR natif
        payouts=True,            # Envoi d'argent (via gateway optimal)
        withdrawals=True,        # Retraits
        opr=True,                # Request-to-pay (via Push USSD si dispo)
        splits=False,
        customer_portal=False,
    ),
    # Wave - QR Code natif + Push
    "WAVE": ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=True,            # QR natif Wave
        payouts=True,            # Wave Payout API
        withdrawals=True,        # Wave Cash-out
        opr=True,                # Request-to-pay
        splits=False,
        customer_portal=False,
    ),
    # Moov Money
    "MOOV": ProviderCapabilities(
        payments=True,
        payment_links=True,      # Via SahelPay
        qr_code=False,
        payouts=True,            # Via gateway optimal
        withdrawals=True,
        opr=True,                # Via Push USSD
        splits=False,
        customer_portal=False,
    ),
    # Carte bancaire générique
    "CARD": ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=False,
        payouts=False,           # Non supporté pour les cartes
        withdrawals=True,        # Virement bancaire
        opr=False,
        splits=True,             # Marketplace splits
        customer_portal=True,    # Gestion des cartes
    ),
    "VISA": ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=False,
        payouts=False,
        withdrawals=True,
        opr=False,
        splits=True,
        customer_portal=True,
    ),
    "MASTERCARD": ProviderCapabilities(
        payments=True,
        payment_links=True,
        qr_code=False,
        payouts=False,
        withdrawals=True,
        opr=False,
        splits=True,
        customer_portal=True,
    ),
    "GIM_UEMOA": ProviderCapabilities(
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

"""
Descriptions des capabilities par méthode de paiement
"""
CAPABILITY_DESCRIPTIONS: Dict[PaymentMethod, Dict[Capability, str]] = {
    "ORANGE_MONEY": {
        "payments": "Paiement via Orange Money",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non disponible",
        "payouts": "Envoi d'argent vers Orange Money",
        "withdrawals": "Retrait vers Orange Money",
        "opr": "Request-to-pay via Push USSD",
        "splits": "Via SahelPay Split",
        "customer_portal": "Non disponible",
    },
    "WAVE": {
        "payments": "Paiement via Wave (QR + Push)",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "QR Code Wave natif",
        "payouts": "Envoi d'argent via Wave",
        "withdrawals": "Retrait vers Wave",
        "opr": "Request-to-pay Wave",
        "splits": "Via SahelPay Split",
        "customer_portal": "Non disponible",
    },
    "MOOV": {
        "payments": "Paiement via Moov Money",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non disponible",
        "payouts": "Envoi d'argent via Moov",
        "withdrawals": "Retrait vers Moov",
        "opr": "Request-to-pay via Push USSD",
        "splits": "Via SahelPay Split",
        "customer_portal": "Non disponible",
    },
    "CARD": {
        "payments": "Paiement par carte (3DS Secure)",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non applicable",
        "payouts": "Non supporté",
        "withdrawals": "Virement bancaire",
        "opr": "Non applicable",
        "splits": "Marketplace splits",
        "customer_portal": "Gestion des cartes",
    },
    "VISA": {
        "payments": "Paiement par carte VISA",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non applicable",
        "payouts": "Non supporté",
        "withdrawals": "Virement bancaire",
        "opr": "Non applicable",
        "splits": "Marketplace splits",
        "customer_portal": "Gestion des cartes",
    },
    "MASTERCARD": {
        "payments": "Paiement par Mastercard",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non applicable",
        "payouts": "Non supporté",
        "withdrawals": "Virement bancaire",
        "opr": "Non applicable",
        "splits": "Marketplace splits",
        "customer_portal": "Gestion des cartes",
    },
    "GIM_UEMOA": {
        "payments": "Paiement par carte GIM-UEMOA",
        "payment_links": "Liens de paiement SahelPay",
        "qr_code": "Non applicable",
        "payouts": "Non supporté",
        "withdrawals": "Virement bancaire",
        "opr": "Non applicable",
        "splits": "Via SahelPay Split",
        "customer_portal": "Non disponible",
    },
}

# Alias pour compatibilité
CAPABILITY_JUSTIFICATIONS = CAPABILITY_DESCRIPTIONS


def has_capability(method: PaymentMethod, capability: Capability) -> bool:
    """
    Vérifier si une méthode de paiement supporte une capability

    Args:
        method: Méthode de paiement
        capability: Capability à vérifier

    Returns:
        True si la méthode supporte la capability
    """
    caps = CAPABILITIES.get(method)
    if not caps:
        return False
    return getattr(caps, capability, False)


def get_capabilities(method: PaymentMethod) -> Optional[ProviderCapabilities]:
    """
    Obtenir toutes les capabilities d'une méthode de paiement

    Args:
        method: Méthode de paiement

    Returns:
        ProviderCapabilities ou None si méthode inconnue
    """
    return CAPABILITIES.get(method)


def get_capability_description(method: PaymentMethod, capability: Capability) -> str:
    """
    Obtenir la description d'une capability

    Args:
        method: Méthode de paiement
        capability: Capability

    Returns:
        Description ou "Non documenté"
    """
    return CAPABILITY_DESCRIPTIONS.get(method, {}).get(capability, "Non documenté")


# Alias pour compatibilité
def get_justification(method: PaymentMethod, capability: Capability) -> str:
    """Alias pour get_capability_description"""
    return get_capability_description(method, capability)


def get_methods_with_capability(capability: Capability) -> List[PaymentMethod]:
    """
    Lister les méthodes de paiement supportant une capability

    Args:
        capability: Capability à rechercher

    Returns:
        Liste des méthodes supportant la capability
    """
    return [
        method
        for method, caps in CAPABILITIES.items()
        if has_capability(method, capability)
    ]


# Alias pour compatibilité
def get_providers_with_capability(capability: Capability) -> List[PaymentMethod]:
    """Alias pour get_methods_with_capability"""
    return get_methods_with_capability(capability)
