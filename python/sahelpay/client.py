"""
Client principal SahelPay
"""

import json
import hmac
import hashlib
from typing import Optional, Dict, Any, List
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode

from .exceptions import SahelPayError, APIError, AuthenticationError, ValidationError
from .resources import Payment, PaymentLink, WebhookEvent


class PaymentsAPI:
    """API pour gérer les paiements"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        amount: float,
        provider: str,
        customer_phone: str,
        currency: str = "XOF",
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        callback_url: Optional[str] = None,
        return_url: Optional[str] = None,
        payment_method: Optional[str] = None,
        country: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
        client_reference: Optional[str] = None,
        hosted_checkout: bool = True,
    ) -> Payment:
        """
        Créer un nouveau paiement

        Args:
            amount: Montant en FCFA
            provider: ORANGE_MONEY, WAVE, ou MOOV
            customer_phone: Numéro de téléphone du client
            currency: Devise (défaut: XOF)
            description: Description du paiement
            metadata: Données personnalisées
            callback_url: URL de callback webhook
            return_url: URL de redirection après paiement
            hosted_checkout: Si True (défaut), affiche la page SahelPay.
                            Si False, redirige directement vers le provider.

        Returns:
            Payment: Objet paiement créé
        """
        inferred_payment_method = payment_method
        if not inferred_payment_method and provider in ["CARD", "CINETPAY", "GIM_UEMOA", "VISA", "MASTERCARD"]:
            inferred_payment_method = "CARD"

        if inferred_payment_method == "CARD":
            if not customer_name:
                raise ValidationError(
                    "CinetPay CREDIT_CARD requires customerName", "VALIDATION_ERROR", 400)
            if not customer_email:
                raise ValidationError(
                    "CinetPay CREDIT_CARD requires customerEmail", "VALIDATION_ERROR", 400)
            if not customer_phone:
                raise ValidationError(
                    "CinetPay CREDIT_CARD requires customerPhone", "VALIDATION_ERROR", 400)

        final_metadata: Dict[str, Any] = {}
        if metadata:
            final_metadata.update(metadata)
        if description:
            final_metadata.setdefault("description", description)
        if callback_url:
            final_metadata.setdefault("callback_url", callback_url)

        data: Dict[str, Any] = {
            "amount": amount,
            "currency": currency,
            "provider": provider,
            "payment_method": inferred_payment_method,
            "country": country,
            "customer_phone": customer_phone,
            "customer_name": customer_name,
            "customer_email": customer_email,
            "return_url": return_url,
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference": client_reference,
            "hosted_checkout": hosted_checkout,
        }

        if final_metadata:
            data["metadata"] = final_metadata

        response = self._client._request("POST", "/v1/payments", data)
        payload = response.get("data", {})
        payload["customer_phone"] = customer_phone
        payload["provider"] = provider
        if inferred_payment_method:
            payload["payment_method"] = inferred_payment_method
        if country:
            payload["country"] = country
        if final_metadata:
            payload["metadata"] = final_metadata
        return Payment.from_dict(payload)

    def search(self, client_reference: str) -> Optional[Payment]:
        """Rechercher un paiement par référence client"""
        response = self._client._request(
            "GET", f"/v1/payments/search?client_reference={client_reference}")
        data = response.get("data")
        if not data:
            return None
        return Payment.from_dict(data)

    def details(self, payment_id: str) -> Payment:
        """Obtenir les détails financiers complets"""
        response = self._client._request(
            "GET", f"/v1/payments/{payment_id}/details")
        return Payment.from_dict(response.get("data", {}))

    def reconcile(self, payment_id: str) -> Dict[str, Any]:
        """Réconcilier manuellement un paiement"""
        return self._client._request("POST", f"/v1/payments/{payment_id}/reconcile")

    def providers(self) -> List[Any]:
        """Obtenir les providers disponibles"""
        response = self._client._request("GET", "/v1/payments/providers")
        data = response.get("data", [])
        if isinstance(data, dict):
            return data.get("providers", [])
        return data

    def recommend(self, phone: str) -> Dict[str, Any]:
        """
        Recommander un provider basé sur le numéro de téléphone

        Args:
            phone: Numéro de téléphone (+223...)

        Returns:
            Dict avec provider et confidence
        """
        response = self._client._request(
            "GET", f"/v1/payments/recommend?phone={phone}")
        return response.get("data", {})

    def poll(
        self,
        reference_id: str,
        timeout: int = 120,
        interval: float = 2.0,
        on_status: Optional[callable] = None,
    ) -> Payment:
        """
        Polling intelligent pour attendre la fin d'une transaction

        Args:
            reference_id: Référence du paiement
            timeout: Timeout en secondes (défaut: 120)
            interval: Intervalle initial entre les checks (défaut: 2s)
            on_status: Callback appelé à chaque changement de statut

        Returns:
            Payment: Paiement avec statut final

        Raises:
            SahelPayError: Si timeout atteint
        """
        import time
        start = time.time()
        delay = interval

        while True:
            result = self.check_status(reference_id)
            status = result["status"]
            payment = result["payment"]

            if on_status:
                on_status(status, payment)

            if status in ["SUCCESS", "FAILED", "CANCELLED"]:
                return payment

            if time.time() - start > timeout:
                raise SahelPayError("Polling timeout", "TIMEOUT")

            time.sleep(delay)
            delay = min(delay * 1.5, 10)  # Backoff, max 10s

    def retrieve(self, reference_id: str) -> Payment:
        """Récupérer un paiement par référence"""
        response = self._client._request(
            "GET", f"/v1/payments/{reference_id}/status")
        return Payment.from_dict(response.get("data", {}))

    def check_status(self, reference_id: str) -> Dict[str, Any]:
        """Vérifier le statut d'un paiement"""
        response = self._client._request(
            "GET", f"/v1/payments/{reference_id}/status")
        return {
            "status": response.get("data", {}).get("status"),
            "payment": Payment.from_dict(response.get("data", {})),
        }

    def list(
        self,
        limit: int = 20,
        page: int = 1,
        offset: Optional[int] = None,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lister les paiements"""
        computed_offset = offset if offset is not None else max(
            page - 1, 0) * limit
        params = {"limit": limit, "offset": computed_offset}
        if status:
            params["status"] = status

        response = self._client._request(
            "GET",
            f"/v1/payments/history?{urlencode(params)}"
        )

        data = response.get("data", {})
        return {
            "payments": [Payment.from_dict(p) for p in data.get("transactions", [])],
            "pagination": data.get("pagination", {}),
        }


class PaymentLinksAPI:
    """API pour gérer les liens de paiement"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        title: str,
        price: float,
        currency: str = "XOF",
        redirect_url: Optional[str] = None,
    ) -> PaymentLink:
        """Créer un lien de paiement"""
        data = {
            "title": title,
            "price": price,
            "currency": currency,
        }
        if redirect_url:
            data["redirect_url"] = redirect_url

        response = self._client._request("POST", "/v1/payment-links", data)
        return PaymentLink.from_dict(response.get("data", {}))

    def list(self) -> List[PaymentLink]:
        """Lister les liens de paiement"""
        response = self._client._request("GET", "/v1/payment-links")
        return [PaymentLink.from_dict(link) for link in response.get("data", [])]

    def retrieve(self, slug: str) -> PaymentLink:
        """Récupérer un lien par slug"""
        response = self._client._request("GET", f"/v1/payment-links/{slug}")
        return PaymentLink.from_dict(response.get("data", {}))

    def deactivate(self, link_id: str) -> PaymentLink:
        """Désactiver un lien"""
        response = self._client._request(
            "PATCH", f"/v1/payment-links/{link_id}/deactivate", {})
        return PaymentLink.from_dict(response.get("data", {}))

    def activate(self, link_id: str) -> PaymentLink:
        """Activer un lien"""
        response = self._client._request(
            "PATCH", f"/v1/payment-links/{link_id}/activate", {})
        return PaymentLink.from_dict(response.get("data", {}))


class WebhooksAPI:
    """API pour gérer les webhooks"""

    def __init__(self, client: "Client"):
        self._client = client

    def verify_signature(
        self,
        payload: str,
        signature: str,
        secret: str
    ) -> bool:
        """
        Vérifier la signature d'un webhook

        Args:
            payload: Corps de la requête (string)
            signature: Header X-SahelPay-Signature
            secret: Votre secret webhook

        Returns:
            bool: True si la signature est valide
        """
        expected = hmac.new(
            secret.encode("utf-8"),
            payload.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected)

    def parse_event(
        self,
        payload: str,
        signature: str,
        secret: str
    ) -> WebhookEvent:
        """
        Parser et vérifier un événement webhook

        Args:
            payload: Corps de la requête
            signature: Header X-SahelPay-Signature
            secret: Votre secret webhook

        Returns:
            WebhookEvent: Événement parsé

        Raises:
            SahelPayError: Si la signature est invalide
        """
        if not self.verify_signature(payload, signature, secret):
            raise SahelPayError("Invalid webhook signature",
                                "INVALID_SIGNATURE")

        data = json.loads(payload)
        return WebhookEvent.from_dict(data)


class PayoutsAPI:
    """API pour gérer les payouts (envoi d'argent)"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        amount: float,
        provider: str,
        recipient_phone: str,
        recipient_name: Optional[str] = None,
        description: Optional[str] = None,
        payout_type: str = "OTHER",
        metadata: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
    ) -> "Payout":
        """
        Créer un nouveau payout (envoi d'argent)

        Args:
            amount: Montant en FCFA (min: 100, max: 5,000,000)
            provider: ORANGE_MONEY, WAVE, ou MOOV
            recipient_phone: Numéro de téléphone du destinataire
            recipient_name: Nom du destinataire (optionnel)
            description: Description du payout (optionnel)
            payout_type: Type de payout (MERCHANT_WITHDRAWAL, SUPPLIER_PAYMENT, etc.)
            metadata: Données personnalisées
            idempotency_key: Clé d'idempotence pour éviter les doublons

        Returns:
            Payout: Objet payout créé
        """
        if amount < 100:
            raise ValidationError(
                "Le montant minimum est de 100 FCFA", "INVALID_AMOUNT", 400)
        if amount > 5000000:
            raise ValidationError(
                "Le montant maximum est de 5,000,000 FCFA", "INVALID_AMOUNT", 400)

        data = {
            "amount": amount,
            "provider": provider,
            "recipient_phone": recipient_phone,
        }

        if recipient_name:
            data["recipient_name"] = recipient_name
        if description:
            data["description"] = description
        if payout_type:
            data["type"] = payout_type
        if metadata:
            data["metadata"] = metadata
        if idempotency_key:
            data["idempotency_key"] = idempotency_key

        response = self._client._request("POST", "/v1/payouts", data)
        from .resources import Payout
        return Payout.from_dict(response.get("data", {}))

    def retrieve(self, reference: str) -> "Payout":
        """Récupérer un payout par référence"""
        response = self._client._request("GET", f"/v1/payouts/{reference}")
        from .resources import Payout
        return Payout.from_dict(response.get("data", {}))

    def list(
        self,
        limit: int = 20,
        page: int = 1,
        status: Optional[str] = None,
        payout_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lister les payouts"""
        params = {"limit": limit, "page": page}
        if status:
            params["status"] = status
        if payout_type:
            params["type"] = payout_type

        response = self._client._request(
            "GET",
            f"/v1/payouts?{urlencode(params)}"
        )

        from .resources import Payout
        data = response.get("data", {})
        return {
            "payouts": [Payout.from_dict(p) for p in data.get("payouts", [])],
            "pagination": data.get("pagination", {}),
        }

    def cancel(self, reference: str) -> "Payout":
        """Annuler un payout en attente"""
        response = self._client._request("DELETE", f"/v1/payouts/{reference}")
        from .resources import Payout
        return Payout.from_dict(response.get("data", {}))

    def stats(self) -> "PayoutStats":
        """Obtenir les statistiques des payouts"""
        response = self._client._request("GET", "/v1/payouts/stats")
        from .resources import PayoutStats
        return PayoutStats.from_dict(response.get("data", {}))


class WithdrawalsAPI:
    """API pour gérer les retraits de solde marchand"""

    def __init__(self, client: "Client"):
        self._client = client

    def balance(self) -> Dict[str, Any]:
        """
        Obtenir le solde disponible

        Returns:
            Dict avec available, pending, currency
        """
        response = self._client._request("GET", "/v1/withdrawals/balance")
        return response.get("data", {})

    def create(
        self,
        amount: float,
        recipient_phone: str,
        recipient_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Créer un retrait

        Args:
            amount: Montant à retirer
            recipient_phone: Numéro de téléphone destinataire
            recipient_name: Nom du destinataire (optionnel)
            description: Description (optionnel)

        Returns:
            Dict avec les détails du retrait
        """
        data = {
            "amount": amount,
            "recipient_phone": recipient_phone,
        }
        if recipient_name:
            data["recipient_name"] = recipient_name
        if description:
            data["description"] = description

        response = self._client._request("POST", "/v1/withdrawals", data)
        return response.get("data", {})

    def list(
        self,
        limit: int = 20,
        page: int = 1,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lister les retraits"""
        params = {"limit": limit, "page": page}
        if status:
            params["status"] = status

        response = self._client._request(
            "GET",
            f"/v1/withdrawals?{urlencode(params)}"
        )
        return response.get("data", {})

    def stats(self) -> Dict[str, Any]:
        """Obtenir les statistiques des retraits"""
        response = self._client._request("GET", "/v1/withdrawals/stats")
        return response.get("data", {})

    def cancel(self, withdrawal_id: str) -> Dict[str, Any]:
        """Annuler un retrait en attente"""
        response = self._client._request(
            "PATCH", f"/v1/withdrawals/{withdrawal_id}/cancel")
        return response.get("data", {})


class PlansAPI:
    """API pour gérer les plans d'abonnement"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        name: str,
        amount: float,
        interval: str = "MONTHLY",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Créer un nouveau plan d'abonnement

        Args:
            name: Nom du plan
            amount: Montant en FCFA
            interval: WEEKLY ou MONTHLY
            description: Description du plan (optionnel)

        Returns:
            Dict avec les détails du plan créé
        """
        data = {
            "name": name,
            "amount": amount,
            "interval": interval,
        }
        if description:
            data["description"] = description

        response = self._client._request("POST", "/v1/plans", data)
        return response.get("data", {})

    def list(self) -> List[Dict[str, Any]]:
        """Lister tous les plans"""
        response = self._client._request("GET", "/v1/plans")
        return response.get("data", [])

    def retrieve(self, plan_id: str) -> Dict[str, Any]:
        """Récupérer un plan par ID"""
        response = self._client._request("GET", f"/v1/plans/{plan_id}")
        return response.get("data", {})

    def deactivate(self, plan_id: str) -> Dict[str, Any]:
        """Désactiver un plan"""
        response = self._client._request(
            "PATCH", f"/v1/plans/{plan_id}/deactivate", {})
        return response.get("data", {})

    def delete(self, plan_id: str) -> None:
        """Supprimer un plan"""
        self._client._request("DELETE", f"/v1/plans/{plan_id}")


class SubscriptionsAPI:
    """API pour gérer les abonnements"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        plan_id: str,
        customer_phone: str,
        start_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Créer un nouvel abonnement

        Args:
            plan_id: ID du plan
            customer_phone: Numéro de téléphone du client
            start_date: Date de début (ISO format, optionnel)

        Returns:
            Dict avec les détails de l'abonnement créé

        Example:
            >>> subscription = client.subscriptions.create(
            ...     plan_id="plan_xxx",
            ...     customer_phone="+22370000000"
            ... )
        """
        data = {
            "plan_id": plan_id,
            "customer_phone": customer_phone,
        }
        if start_date:
            data["start_date"] = start_date

        response = self._client._request("POST", "/v1/subscriptions", data)
        return response.get("data", {})

    def list(
        self,
        plan_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        Lister les abonnements

        Args:
            plan_id: Filtrer par plan (optionnel)
            status: Filtrer par statut (ACTIVE, PAST_DUE, CANCELLED)
            limit: Nombre max de résultats
        """
        params = {"limit": limit}
        if plan_id:
            params["plan_id"] = plan_id
        if status:
            params["status"] = status

        response = self._client._request(
            "GET",
            f"/v1/subscriptions?{urlencode(params)}"
        )
        return response.get("data", {})

    def retrieve(self, subscription_id: str) -> Dict[str, Any]:
        """Récupérer un abonnement par ID"""
        response = self._client._request(
            "GET", f"/v1/subscriptions/{subscription_id}")
        return response.get("data", {})

    def cancel(self, subscription_id: str) -> Dict[str, Any]:
        """Annuler un abonnement"""
        response = self._client._request(
            "DELETE", f"/v1/subscriptions/{subscription_id}")
        return response


class CustomersAPI:
    """API pour gérer les clients"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        phone: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Créer un nouveau client

        Args:
            phone: Numéro de téléphone
            name: Nom du client (optionnel)
            email: Email du client (optionnel)
            metadata: Données personnalisées (optionnel)
        """
        data = {"phone": phone}
        if name:
            data["name"] = name
        if email:
            data["email"] = email
        if metadata:
            data["metadata"] = metadata

        response = self._client._request("POST", "/v1/customers", data)
        return response.get("data", {})

    def list(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Lister les clients"""
        params = {"limit": limit, "offset": offset}
        response = self._client._request(
            "GET",
            f"/v1/customers?{urlencode(params)}"
        )
        return response.get("data", {})

    def retrieve(self, customer_id: str) -> Dict[str, Any]:
        """Récupérer un client par ID"""
        response = self._client._request("GET", f"/v1/customers/{customer_id}")
        return response.get("data", {})

    def update(
        self,
        customer_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Mettre à jour un client"""
        data = {}
        if name:
            data["name"] = name
        if email:
            data["email"] = email
        if metadata:
            data["metadata"] = metadata

        response = self._client._request(
            "PATCH", f"/v1/customers/{customer_id}", data)
        return response.get("data", {})

    def delete(self, customer_id: str) -> None:
        """Supprimer un client"""
        self._client._request("DELETE", f"/v1/customers/{customer_id}")


class PortalAPI:
    """API pour le Customer Portal (comme Stripe Billing Portal)"""

    def __init__(self, client: "Client"):
        self._client = client

    def create_session(
        self,
        customer_phone: str,
        customer_name: Optional[str] = None,
        customer_email: Optional[str] = None,
        return_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Créer une session Customer Portal

        Permet à vos clients de gérer leurs abonnements, méthodes de paiement
        et consulter leur historique de transactions.

        Args:
            customer_phone: Numéro de téléphone du client
            customer_name: Nom du client (optionnel)
            customer_email: Email du client (optionnel)
            return_url: URL de retour après utilisation du portal (optionnel)

        Returns:
            Dict avec id, url, customer_id, expires_at

        Example:
            >>> session = client.portal.create_session(
            ...     customer_phone="+22370000000",
            ...     return_url="https://monapp.com/account"
            ... )
            >>> # Redirigez le client vers session["url"]
        """
        data = {"customer_phone": customer_phone}
        if customer_name:
            data["customer_name"] = customer_name
        if customer_email:
            data["customer_email"] = customer_email
        if return_url:
            data["return_url"] = return_url

        response = self._client._request("POST", "/v1/portal/sessions", data)
        return response.get("data", {})


class RefundsAPI:
    """API pour gérer les remboursements"""

    def __init__(self, client: "Client"):
        self._client = client

    def create(
        self,
        payment_id: str,
        amount: float,
        reason: Optional[str] = None,
        refund_fees: bool = False,
    ) -> "Refund":
        """Créer un remboursement"""
        data = {
            "payment_id": payment_id,
            "amount": amount,
            "refund_fees": refund_fees,
        }
        if reason:
            data["reason"] = reason

        response = self._client._request("POST", "/v1/refunds", data)
        from .resources import Refund
        return Refund.from_dict(response.get("data", {}))

    def list(
        self,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Lister les remboursements"""
        params = {"limit": limit, "offset": offset}
        response = self._client._request(
            "GET", f"/v1/refunds?{urlencode(params)}")
        
        from .resources import Refund
        data = response.get("data", {})
        return {
            "refunds": [Refund.from_dict(r) for r in data.get("refunds", [])],
            "pagination": data.get("pagination", {}),
        }


class Client:
    """
    Client principal SahelPay

    Example:
        >>> client = sahelpay.Client(secret_key="sk_live_xxx")
        >>> payment = client.payments.create(
        ...     amount=5000,
        ...     provider="ORANGE_MONEY",
        ...     customer_phone="+22370000000"
        ... )
        >>> # Abonnements
        >>> plan = client.plans.create(name="Premium", amount=5000, interval="MONTHLY")
        >>> subscription = client.subscriptions.create(plan_id=plan["id"], customer_phone="+22370000000")
    """

    SANDBOX_URL = "https://sandbox.sahelpay.ml"
    PRODUCTION_URL = "https://api.sahelpay.ml"

    def __init__(
        self,
        secret_key: str,
        environment: str = "production",
        base_url: Optional[str] = None,
        timeout: int = 30,
    ):
        """
        Initialiser le client SahelPay

        Args:
            secret_key: Votre clé secrète (sk_live_xxx ou sk_test_xxx)
            environment: 'production' ou 'sandbox'
            base_url: URL de base personnalisée (optionnel)
            timeout: Timeout en secondes (défaut: 30)
        """
        if not secret_key:
            raise ValueError("secret_key is required")

        self._secret_key = secret_key
        self._timeout = timeout

        if base_url:
            self._base_url = base_url
        elif environment == "sandbox":
            self._base_url = self.SANDBOX_URL
        else:
            self._base_url = self.PRODUCTION_URL

        # APIs
        self.payments = PaymentsAPI(self)
        self.payment_links = PaymentLinksAPI(self)
        self.payouts = PayoutsAPI(self)
        self.withdrawals = WithdrawalsAPI(self)
        self.webhooks = WebhooksAPI(self)
        self.refunds = RefundsAPI(self)
        self.plans = PlansAPI(self)
        self.subscriptions = SubscriptionsAPI(self)
        self.customers = CustomersAPI(self)
        self.portal = PortalAPI(self)

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Effectuer une requête API"""
        url = f"{self._base_url}{path}"

        headers = {
            "Authorization": f"Bearer {self._secret_key}",
            "Content-Type": "application/json",
            "User-Agent": "SahelPay-Python/1.0.0",
        }

        body = None
        if data and method != "GET":
            body = json.dumps(data).encode("utf-8")

        request = Request(url, data=body, headers=headers, method=method)

        try:
            with urlopen(request, timeout=self._timeout) as response:
                return json.loads(response.read().decode("utf-8"))

        except HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                error_info = error_data.get("error", {})
                message = error_info.get("message", str(e))
                code = error_info.get("code", "API_ERROR")
            except json.JSONDecodeError:
                message = str(e)
                code = "API_ERROR"

            if e.code == 401:
                raise AuthenticationError(message, code, e.code)
            elif e.code == 400:
                raise ValidationError(message, code, e.code)
            else:
                raise APIError(message, code, e.code)

        except URLError as e:
            raise SahelPayError(f"Network error: {e.reason}", "NETWORK_ERROR")
