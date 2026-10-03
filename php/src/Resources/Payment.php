<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les paiements Mobile Money (Orange Money)
 */
class Payment
{
    /**
     * Méthodes de paiement acceptées par l'API.
     * ORANGE_MONEY et ORANGE sont des alias de MOBILE_MONEY (Orange Money, seul rail intégré).
     */
    public const PAYMENT_METHODS = ['MOBILE_MONEY', 'ORANGE_MONEY', 'ORANGE'];

    /**
     * Champs transmis à POST /v1/payments. L'API rejette (400) tout champ inconnu.
     */
    private const ALLOWED_FIELDS = [
        'amount', 'currency', 'country', 'payment_method', 'provider',
        'customer', 'customer_phone', 'customer_name', 'customer_email', 'beneficiary_name',
        'description', 'client_reference', 'items',
        'return_url', 'success_url', 'cancel_url', 'hosted_checkout', 'metadata',
    ];

    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Initier un paiement Mobile Money (Orange Money).
     *
     * @param array{
     *   amount: int,
     *   payment_method?: string,
     *   provider?: string,
     *   currency?: string,
     *   country?: string,
     *   customer_phone?: string,
     *   customer_name?: string,
     *   customer_email?: string,
     *   description?: string,
     *   client_reference?: string,
     *   items?: array<int, array{product_id: string, quantity?: int}>,
     *   return_url?: string,
     *   success_url?: string,
     *   cancel_url?: string,
     *   hosted_checkout?: bool,
     *   idempotency_key?: string,
     *   marketplace?: array{
     *     order_number?: string,
     *     customer_name?: string,
     *     items_count?: int,
     *     shipping_address?: string
     *   },
     *   sandbox?: bool,
     *   mock?: bool,
     *   metadata?: array
     * } $data
     *
     * - `amount` : entier en FCFA (100 à 5 000 000).
     * - `payment_method` : MOBILE_MONEY uniquement (alias ORANGE_MONEY / ORANGE).
     * - `hosted_checkout` (défaut true) : la réponse contient `checkout_url` (page SahelPay) ;
     *   si false, le paiement est initié directement auprès d'Orange Money (`redirect_url`).
     * - `items` : partenaires SPAY uniquement, lignes du catalogue validé ;
     *   `amount` doit en être le total exact.
     * - `idempotency_key` : envoyée dans l'en-tête X-Idempotency-Key (générée si absente).
     *   Réutilisez la même clé pour retenter le même paiement.
     *
     * @throws \InvalidArgumentException Champ inconnu, montant manquant ou méthode non supportée
     */
    public function initiate(array $data): Response
    {
        $this->validateRequired($data, ['amount']);

        // Options SDK traduites en metadata
        $metadata = $data['metadata'] ?? [];
        if (!is_array($metadata)) {
            throw new \InvalidArgumentException("Le champ 'metadata' doit être un tableau");
        }
        if (isset($data['marketplace'])) {
            $metadata['marketplace'] = $data['marketplace'];
        }
        // `sandbox` appelle l'environnement de test de l'opérateur.
        if (isset($data['sandbox'])) {
            $metadata['sandbox'] = (bool) $data['sandbox'];
        }
        // `mock` court-circuite l'opérateur : simulateur SahelPay, statut piloté
        // par le montant (4000 réussi, 4001 échoué, 4002 en attente).
        if (isset($data['mock'])) {
            $metadata['sahelpay_mock'] = (bool) $data['mock'];
        }

        // L'API exige cet en-tête : sans clé fournie, on en génère une unique.
        $headers = [
            'X-Idempotency-Key' => !empty($data['idempotency_key'])
                ? (string) $data['idempotency_key']
                : 'sdk_' . bin2hex(random_bytes(16)),
        ];

        unset($data['marketplace'], $data['sandbox'], $data['mock'], $data['idempotency_key'], $data['metadata']);

        $unknown = array_diff(array_keys($data), self::ALLOWED_FIELDS);
        if (!empty($unknown)) {
            throw new \InvalidArgumentException(
                'Champ(s) non supporté(s) par POST /v1/payments : ' . implode(', ', $unknown)
            );
        }

        foreach (['payment_method', 'provider'] as $field) {
            if (isset($data[$field]) && !in_array(strtoupper((string) $data[$field]), self::PAYMENT_METHODS, true)) {
                throw new \InvalidArgumentException(
                    "{$field} non supporté : {$data[$field]}. Seul Orange Money (MOBILE_MONEY / ORANGE_MONEY) est disponible."
                );
            }
        }

        if (isset($data['items'])) {
            if (!is_array($data['items']) || empty($data['items'])) {
                throw new \InvalidArgumentException("Le champ 'items' doit être une liste non vide");
            }
            foreach ($data['items'] as $item) {
                if (!is_array($item) || empty($item['product_id'])) {
                    throw new \InvalidArgumentException("Chaque ligne de 'items' requiert 'product_id'");
                }
            }
            $data['items'] = array_values($data['items']);
        }

        $data['hosted_checkout'] = isset($data['hosted_checkout']) ? (bool) $data['hosted_checkout'] : true;

        // Objet customer du contrat d'intégration (les champs à plat restent acceptés par l'API).
        if (!isset($data['customer'])) {
            $customer = array_filter([
                'phone' => $data['customer_phone'] ?? null,
                'name' => $data['customer_name'] ?? null,
                'email' => $data['customer_email'] ?? null,
            ], static fn ($v) => $v !== null && $v !== '');
            if (!empty($customer)) {
                $data['customer'] = $customer;
            }
        }

        if (!empty($metadata)) {
            $data['metadata'] = $metadata;
        }

        // API core: POST /v1/payments
        return $this->client->post('/payments', $data, $headers);
    }

    /**
     * URL vers laquelle rediriger le client après initiate() :
     * `checkout_url` (hosted checkout) sinon `redirect_url` (flux direct).
     */
    public static function redirectUrl(Response $payment): ?string
    {
        return $payment->checkout_url ?? $payment->redirect_url;
    }

    /**
     * Rechercher un paiement par référence client (votre ID de commande)
     */
    public function search(string $clientReference): Response
    {
        return $this->client->get("/payments/search", [
            'client_reference' => $clientReference
        ]);
    }

    /**
     * Obtenir les détails financiers complets (ledger, frais, etc.)
     */
    public function details(string $id): Response
    {
        return $this->client->get("/payments/{$id}/details");
    }

    /**
     * Réconcilier manuellement un paiement
     */
    public function reconcile(string $id): Response
    {
        return $this->client->post("/payments/{$id}/reconcile");
    }

    /**
     * Vérifier le statut d'un paiement
     */
    public function verify(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}/status");
    }

    /**
     * Obtenir les détails d'un paiement
     */
    public function get(string $referenceId): Response
    {
        return $this->client->get("/payments/{$referenceId}");
    }

    /**
     * Lister les paiements
     *
     * @param array{
     *   limit?: int,
     *   offset?: int,
     *   status?: string
     * } $options
     */
    public function all(array $options = []): Response
    {
        // API core: GET /v1/payments/history
        return $this->client->get('/payments/history', $options);
    }

    /**
     * Valider les champs requis
     */
    private function validateRequired(array $data, array $required): void
    {
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                throw new \InvalidArgumentException("Le champ '{$field}' est requis");
            }
        }
    }
}
