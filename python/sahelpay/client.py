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

        Returns:
            Payment: Objet paiement créé
        """
        data = {
            "amount": amount,
            "currency": currency,
            "provider": provider,
            "customer_phone": customer_phone,
        }

        if description:
            data["description"] = description
        if metadata:
            data["metadata"] = metadata
        if callback_url:
            data["callback_url"] = callback_url
        if return_url:
            data["return_url"] = return_url

        response = self._client._request("POST", "/v1/payments", data)
        return Payment.from_dict(response.get("data", {}))

    def providers(self) -> List[str]:
        """Obtenir les providers disponibles"""
        response = self._client._request("GET", "/v1/payments/providers")
        return response.get("data", {}).get("providers", [])

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
        response = self._client._request("GET", f"/v1/payments/{reference_id}")
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
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Lister les paiements"""
        params = {"limit": limit, "page": page}
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
            "DELETE", f"/v1/payment-links/{link_id}")
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
        >>> payout = client.payouts.create(
        ...     amount=10000,
        ...     provider="WAVE",
        ...     recipient_phone="+22377000000"
        ... )
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
