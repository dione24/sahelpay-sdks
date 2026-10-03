<?php

declare(strict_types=1);

namespace SahelPay\Resources;

use SahelPay\Http\Client;
use SahelPay\Http\Response;

/**
 * Resource pour les retraits du solde marchand vers Orange Money.
 *
 * Les retraits sont traités manuellement par SahelPay. Seul ORANGE_MONEY est
 * accepté comme destination. Montant : entier en FCFA, 50 000 à 5 000 000.
 * Frais : 1 % (minimum 100 FCFA), déduits du montant reçu.
 */
class Withdrawal
{
    public const PROVIDER = 'ORANGE_MONEY';
    public const MIN_AMOUNT = 50000;
    public const MAX_AMOUNT = 5000000;

    private const ALLOWED_FIELDS = ['amount', 'phone_number', 'provider', 'notes', 'quoted_fee', 'idempotency_key'];

    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    /**
     * Solde du marchand (source : ledger).
     * GET /v1/withdrawals/balance
     *
     * Contient available_balance, pending_balance, reserved_balance, total_balance,
     * pending_withdrawals, currency, kyc_level, kyc_status, computed_at.
     */
    public function balance(): Response
    {
        return $this->client->get('/withdrawals/balance');
    }

    /**
     * Devis avant confirmation : amount, fee, amount_debited, recipient_amount, currency, provider.
     * GET /v1/withdrawals/quote?amount=
     *
     * Passez ensuite `fee` comme `quoted_fee` à create() : l'API refuse (409) si les frais ont changé.
     */
    public function quote(int $amount): Response
    {
        $this->validateAmount($amount);

        return $this->client->get('/withdrawals/quote', ['amount' => $amount]);
    }

    /**
     * Créer une demande de retrait.
     * POST /v1/withdrawals (en-tête X-Idempotency-Key obligatoire, généré si absent)
     *
     * @param array{
     *   amount: int,
     *   phone_number: string,
     *   provider?: 'ORANGE_MONEY',
     *   notes?: string,
     *   quoted_fee?: int,
     *   idempotency_key?: string
     * } $data
     *
     * `idempotency_key` : stable par retrait, réutilisez-la pour retenter la même demande.
     * Une clé réutilisée avec un autre montant ou numéro est refusée (409).
     */
    public function create(array $data): Response
    {
        $unknown = array_diff(array_keys($data), self::ALLOWED_FIELDS);
        if (!empty($unknown)) {
            throw new \InvalidArgumentException(
                'Champ(s) non supporté(s) par POST /v1/withdrawals : ' . implode(', ', $unknown)
            );
        }

        if (!isset($data['amount'])) {
            throw new \InvalidArgumentException("Le champ 'amount' est requis");
        }
        if (empty($data['phone_number'])) {
            throw new \InvalidArgumentException("Le champ 'phone_number' est requis");
        }
        if (!is_int($data['amount'])) {
            throw new \InvalidArgumentException('Le montant doit être un entier en FCFA');
        }
        $this->validateAmount($data['amount']);

        $data['provider'] = $data['provider'] ?? self::PROVIDER;
        if ($data['provider'] !== self::PROVIDER) {
            throw new \InvalidArgumentException('Provider non supporté. Seul ORANGE_MONEY est disponible pour les retraits.');
        }

        $headers = [
            'X-Idempotency-Key' => !empty($data['idempotency_key'])
                ? (string) $data['idempotency_key']
                : 'sdk_' . bin2hex(random_bytes(16)),
        ];
        unset($data['idempotency_key']);

        return $this->client->post('/withdrawals', $data, $headers);
    }

    /**
     * Lister les demandes de retrait (paginé).
     * GET /v1/withdrawals?page=&limit=
     *
     * @param array{page?: int, limit?: int} $options
     */
    public function all(array $options = []): Response
    {
        $query = array_intersect_key($options, array_flip(['page', 'limit']));

        return $this->client->get('/withdrawals', $query);
    }

    /**
     * Alias de all().
     *
     * @param array{page?: int, limit?: int} $options
     */
    public function list(array $options = []): Response
    {
        return $this->all($options);
    }

    /**
     * Statistiques des retraits.
     * GET /v1/withdrawals/stats
     */
    public function stats(): Response
    {
        return $this->client->get('/withdrawals/stats');
    }

    /**
     * Annuler une demande encore PENDING (les fonds réservés redeviennent disponibles).
     * PATCH /v1/withdrawals/{id}/cancel
     */
    public function cancel(string $id): Response
    {
        if ($id === '') {
            throw new \InvalidArgumentException("L'identifiant du retrait est requis");
        }

        return $this->client->patch('/withdrawals/' . rawurlencode($id) . '/cancel');
    }

    private function validateAmount(int $amount): void
    {
        if ($amount < self::MIN_AMOUNT || $amount > self::MAX_AMOUNT) {
            throw new \InvalidArgumentException('Le montant doit être entre 50 000 et 5 000 000 FCFA');
        }
    }
}
