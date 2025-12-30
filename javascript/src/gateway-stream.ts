/**
 * SahelPay SDK – Gateway Real-time Stream (SSE)
 * 
 * Permet de s'abonner aux changements de configuration gateway en temps réel
 * via Server-Sent Events (SSE).
 * 
 * @example
 * ```typescript
 * // Node.js
 * const stream = new GatewayEventSource({
 *   baseUrl: 'https://api.sahelpay.ml',
 *   token: 'admin_token_here'
 * });
 * 
 * stream.on('gateway.switched', (event) => {
 *   console.log('Gateway changed:', event.data);
 * });
 * 
 * stream.connect();
 * ```
 * 
 * @example
 * ```typescript
 * // React (via hook)
 * import { useGatewayStream } from '@sahelpay/sdk';
 * 
 * function MyComponent() {
 *   const { isConnected, lastEvent } = useGatewayStream({
 *     onEvent: (event) => console.log(event)
 *   });
 * }
 * ```
 */

/**
 * Types d'événements de configuration gateway
 */
export type GatewayConfigEventType =
  | 'connected'
  | 'heartbeat'
  | 'gateway.switched'      // Changement de routing
  | 'provider.toggled'      // Provider activé/désactivé
  | 'provider.maintenance'  // Mise en maintenance
  | 'config.refreshed';     // Configuration rafraîchie

/**
 * Événement de configuration gateway reçu via SSE
 */
export interface GatewayConfigEvent {
  type: GatewayConfigEventType;
  timestamp: string;
  data?: {
    provider?: string;
    gateway?: string;
    enabled?: boolean;
    maintenance?: boolean;
    message?: string;
    adminId?: string;
  };
  message?: string;
  subscribers?: number;
}

/**
 * Options pour GatewayEventSource
 */
export interface GatewayStreamOptions {
  /** URL de base de l'API SahelPay */
  baseUrl: string;
  /** Token d'authentification admin */
  token: string;
  /** Intervalle de reconnexion en ms (défaut: 5000) */
  reconnectInterval?: number;
  /** Nombre max de tentatives de reconnexion (défaut: Infinity) */
  maxReconnectAttempts?: number;
}

/**
 * Classe pour gérer le flux SSE Gateway (Node.js)
 * 
 * Utilise EventSource natif du navigateur ou une implémentation compatible.
 */
export class GatewayEventSource {
  private baseUrl: string;
  private token: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private eventSource: EventSource | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private listeners: Map<GatewayConfigEventType | 'all', Array<(event: GatewayConfigEvent) => void>> = new Map();
  private isConnected = false;

  constructor(options: GatewayStreamOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? Infinity;
  }

  /**
   * Connecter au flux SSE
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = `${this.baseUrl}/admin/gateways/stream?token=${encodeURIComponent(this.token)}`;

    // Vérifier si EventSource est disponible (navigateur)
    if (typeof EventSource !== 'undefined') {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', {
          type: 'connected',
          timestamp: new Date().toISOString(),
        });
      };

      this.eventSource.onmessage = (e) => {
        try {
          const event: GatewayConfigEvent = JSON.parse(e.data);
          this.handleEvent(event);
        } catch (err) {
          console.error('[GatewayStream] Failed to parse event:', err);
        }
      };

      this.eventSource.onerror = (err) => {
        console.error('[GatewayStream] Connection error:', err);
        this.isConnected = false;
        this.eventSource?.close();
        this.eventSource = null;

        // Reconnexion avec backoff exponentiel
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(
            this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
            30000 // Max 30s
          );
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        }
      };
    } else {
      // Node.js: utiliser une implémentation SSE compatible
      console.warn('[GatewayStream] EventSource not available. Install a polyfill or use in browser.');
    }
  }

  /**
   * Déconnecter du flux SSE
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
  }

  /**
   * Écouter un type d'événement spécifique
   */
  on(type: GatewayConfigEventType | 'all', callback: (event: GatewayConfigEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  /**
   * Arrêter d'écouter un événement
   */
  off(type: GatewayConfigEventType | 'all', callback: (event: GatewayConfigEvent) => void): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Émettre un événement vers les listeners
   */
  private emit(type: GatewayConfigEventType, event: GatewayConfigEvent): void {
    // Émettre vers les listeners spécifiques
    const specificListeners = this.listeners.get(type);
    if (specificListeners) {
      specificListeners.forEach(cb => cb(event));
    }

    // Émettre vers les listeners 'all'
    const allListeners = this.listeners.get('all');
    if (allListeners) {
      allListeners.forEach(cb => cb(event));
    }
  }

  /**
   * Gérer un événement reçu
   */
  private handleEvent(event: GatewayConfigEvent): void {
    this.emit(event.type, event);
  }

  /**
   * Vérifier si connecté
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Obtenir le nombre de tentatives de reconnexion
   */
  get attempts(): number {
    return this.reconnectAttempts;
  }
}

/**
 * Hook React pour utiliser le flux Gateway SSE
 * 
 * @example
 * ```tsx
 * function GatewaySettings() {
 *   const { isConnected, lastEvent } = useGatewayStream({
 *     baseUrl: 'https://api.sahelpay.ml',
 *     token: adminToken,
 *     onEvent: (event) => console.log(event)
 *   });
 *   
 *   return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>;
 * }
 * ```
 */
export interface UseGatewayStreamOptions {
  /** URL de base de l'API */
  baseUrl: string;
  /** Token d'authentification */
  token: string;
  /** Callback appelé à chaque événement */
  onEvent?: (event: GatewayConfigEvent) => void;
  /** Active/désactive le stream (défaut: true) */
  enabled?: boolean;
}

export interface UseGatewayStreamReturn {
  /** Si le stream est connecté */
  isConnected: boolean;
  /** Dernier événement reçu */
  lastEvent: GatewayConfigEvent | null;
  /** Nombre de tentatives de reconnexion */
  reconnectAttempts: number;
  /** Force une reconnexion */
  reconnect: () => void;
  /** Déconnecte manuellement */
  disconnect: () => void;
}

/**
 * Hook React pour Gateway Stream
 * 
 * Note: Cette fonction nécessite React. Pour Node.js, utilisez GatewayEventSource directement.
 */
export function useGatewayStream(options: UseGatewayStreamOptions): UseGatewayStreamReturn {
  // Vérifier si React est disponible
  if (typeof window === 'undefined' || !(window as any).React) {
    throw new Error('useGatewayStream requires React. Use GatewayEventSource for Node.js.');
  }

  // Cette implémentation nécessite React hooks
  // Pour une implémentation complète, voir le hook dans le frontend
  const [isConnected, setIsConnected] = (window as any).React.useState(false);
  const [lastEvent, setLastEvent] = (window as any).React.useState<GatewayConfigEvent | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = (window as any).React.useState(0);
  const streamRef = (window as any).React.useRef<GatewayEventSource | null>(null);

  const connect = () => {
    if (streamRef.current) {
      streamRef.current.disconnect();
    }

    const stream = new GatewayEventSource({
      baseUrl: options.baseUrl,
      token: options.token,
    });

    stream.on('all', (event) => {
      setLastEvent(event);
      options.onEvent?.(event);
    });

    stream.connect();
    streamRef.current = stream;
  };

  const disconnect = () => {
    streamRef.current?.disconnect();
    streamRef.current = null;
    setIsConnected(false);
  };

  (window as any).React.useEffect(() => {
    if (options.enabled !== false) {
      connect();
    }
    return () => disconnect();
  }, [options.baseUrl, options.token, options.enabled]);

  return {
    isConnected,
    lastEvent,
    reconnectAttempts,
    reconnect: connect,
    disconnect,
  };
}

