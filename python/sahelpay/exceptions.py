"""
Exceptions pour le SDK SahelPay
"""


class SahelPayError(Exception):
    """Erreur de base SahelPay"""

    def __init__(self, message: str, code: str = None, status_code: int = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

    def __str__(self):
        if self.code:
            return f"[{self.code}] {self.message}"
        return self.message


class APIError(SahelPayError):
    """Erreur API générique"""
    pass


class AuthenticationError(SahelPayError):
    """Erreur d'authentification (clé API invalide)"""
    pass


class ValidationError(SahelPayError):
    """Erreur de validation des paramètres"""
    pass


class ProviderError(SahelPayError):
    """Erreur du provider de paiement"""
    pass


class TimeoutError(SahelPayError):
    """Timeout de la requête"""
    pass
