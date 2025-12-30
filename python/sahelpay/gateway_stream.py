"""
SahelPay SDK – Gateway Real-time Stream (SSE)

Permet de s'abonner aux changements de configuration gateway en temps réel
via Server-Sent Events (SSE).

Example:
    >>> from sahelpay import GatewayStream
    >>> 
    >>> stream = GatewayStream(
    ...     base_url='https://api.sahelpay.ml',
    ...     token='admin_token_here'
    ... )
    >>> 
    >>> def on_gateway_switched(event):
    ...     print(f"Gateway changed: {event['data']}")
    >>> 
    >>> stream.on_event('gateway.switched', on_gateway_switched)
    >>> stream.connect()
"""

import json
import time
import threading
from typing import Callable, Dict, Any, Optional, Literal
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

GatewayConfigEventType = Literal[
    'connected',
    'heartbeat',
    'gateway.switched',
    'provider.toggled',
    'provider.maintenance',
    'config.refreshed',
]

GatewayConfigEvent = Dict[str, Any]


class GatewayStream:
    """
    Classe pour gérer le flux SSE Gateway (Python)
    
    Permet de s'abonner aux changements de configuration gateway en temps réel.
    
    Example:
        >>> stream = GatewayStream(
        ...     base_url='https://api.sahelpay.ml',
        ...     token='admin_token'
        ... )
        >>> 
        >>> stream.on_event('gateway.switched', lambda e: print(e))
        >>> stream.connect()
    """

    def __init__(
        self,
        base_url: str,
        token: str,
        reconnect_interval: int = 5,
        max_reconnect_attempts: Optional[int] = None,
    ):
        """
        Initialiser le flux Gateway SSE

        Args:
            base_url: URL de base de l'API SahelPay
            token: Token d'authentification admin
            reconnect_interval: Intervalle de reconnexion en secondes (défaut: 5)
            max_reconnect_attempts: Nombre max de tentatives (None = infini)
        """
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_attempts = max_reconnect_attempts
        self._listeners: Dict[GatewayConfigEventType, list] = {}
        self._all_listeners: list = []
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._reconnect_attempts = 0
        self._is_connected = False

    def connect(self) -> None:
        """Connecter au flux SSE"""
        if self._running:
            self.disconnect()

        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def disconnect(self) -> None:
        """Déconnecter du flux SSE"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=1)

    def on_event(
        self,
        event_type: GatewayConfigEventType,
        callback: Callable[[GatewayConfigEvent], None],
    ) -> None:
        """
        Écouter un type d'événement spécifique

        Args:
            event_type: Type d'événement à écouter
            callback: Fonction appelée lors de l'événement
        """
        if event_type not in self._listeners:
            self._listeners[event_type] = []
        self._listeners[event_type].append(callback)

    def on_all(self, callback: Callable[[GatewayConfigEvent], None]) -> None:
        """
        Écouter tous les événements

        Args:
            callback: Fonction appelée pour chaque événement
        """
        self._all_listeners.append(callback)

    def _run(self) -> None:
        """Boucle principale de connexion SSE"""
        while self._running:
            try:
                url = f"{self.base_url}/admin/gateways/stream?token={self.token}"
                request = Request(url)
                request.add_header('Accept', 'text/event-stream')
                request.add_header('Cache-Control', 'no-cache')

                with urlopen(request, timeout=30) as response:
                    self._is_connected = True
                    self._reconnect_attempts = 0
                    self._emit('connected', {
                        'type': 'connected',
                        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                    })

                    buffer = b''
                    for line in response:
                        if not self._running:
                            break

                        buffer += line
                        if line.endswith(b'\n\n'):
                            self._process_event(buffer.decode('utf-8'))
                            buffer = b''

            except (HTTPError, URLError, Exception) as e:
                self._is_connected = False
                if not self._running:
                    break

                if (
                    self.max_reconnect_attempts is None
                    or self._reconnect_attempts < self.max_reconnect_attempts
                ):
                    delay = min(
                        self.reconnect_interval * (2 ** self._reconnect_attempts),
                        30  # Max 30s
                    )
                    time.sleep(delay)
                    self._reconnect_attempts += 1
                else:
                    break

    def _process_event(self, data: str) -> None:
        """Traiter un événement SSE reçu"""
        lines = data.strip().split('\n')
        event_data = None

        for line in lines:
            if line.startswith('data: '):
                try:
                    event_data = json.loads(line[6:])  # Remove 'data: '
                except json.JSONDecodeError:
                    pass

        if event_data:
            event_type = event_data.get('type', 'unknown')
            self._emit(event_type, event_data)

    def _emit(self, event_type: str, event: GatewayConfigEvent) -> None:
        """Émettre un événement vers les listeners"""
        # Émettre vers les listeners spécifiques
        listeners = self._listeners.get(event_type, [])
        for callback in listeners:
            try:
                callback(event)
            except Exception as e:
                print(f"[GatewayStream] Error in listener: {e}")

        # Émettre vers les listeners 'all'
        for callback in self._all_listeners:
            try:
                callback(event)
            except Exception as e:
                print(f"[GatewayStream] Error in listener: {e}")

    @property
    def connected(self) -> bool:
        """Vérifier si connecté"""
        return self._is_connected

    @property
    def attempts(self) -> int:
        """Obtenir le nombre de tentatives de reconnexion"""
        return self._reconnect_attempts

