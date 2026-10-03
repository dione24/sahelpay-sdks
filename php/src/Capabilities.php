<?php

declare(strict_types=1);

namespace SahelPay;

/**
 * SahelPay SDK – Capability Matrix
 *
 * Orange Money (Mali) est le seul rail de paiement intégré.
 * Les payouts automatiques sont refusés : utilisez withdrawals().
 */
class Capabilities
{
    public const PAYMENT_METHODS = [
        'ORANGE_MONEY',
    ];

    public const CAPABILITY_TYPES = [
        'payments',
        'payment_links',
        'qr_code',
        'payouts',
        'withdrawals',
        'opr',
        'splits',
        'customer_portal',
    ];

    private const MATRIX = [
        'ORANGE_MONEY' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => false,
            'withdrawals' => true,
            'opr' => false,
            'splits' => false,
            'customer_portal' => false,
        ],
    ];

    private const DESCRIPTIONS = [
        'ORANGE_MONEY' => [
            'payments' => 'Paiement via Orange Money (Mali)',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non disponible',
            'payouts' => 'Indisponible — utilisez withdrawals (retrait manuel)',
            'withdrawals' => 'Retrait manuel vers Orange Money (50 000 à 5 000 000 FCFA)',
            'opr' => 'Non disponible',
            'splits' => 'Non disponible',
            'customer_portal' => 'Portail client SahelPay (indépendant du rail)',
        ],
    ];

    public static function has(string $method, string $capability): bool
    {
        return self::MATRIX[$method][$capability] ?? false;
    }

    public static function get(string $method): ?array
    {
        return self::MATRIX[$method] ?? null;
    }

    public static function getDescription(string $method, string $capability): string
    {
        return self::DESCRIPTIONS[$method][$capability] ?? 'Non documenté';
    }

    public static function getMethodsWithCapability(string $capability): array
    {
        $methods = [];
        foreach (self::MATRIX as $method => $caps) {
            if ($caps[$capability] ?? false) {
                $methods[] = $method;
            }
        }
        return $methods;
    }

    public static function getAll(): array
    {
        return self::MATRIX;
    }
}
