<?php

declare(strict_types=1);

namespace SahelPay;

/**
 * SahelPay SDK – Capability Matrix
 *
 * Définit les fonctionnalités disponibles pour chaque MÉTHODE DE PAIEMENT.
 *
 * ⚠️ Le routing interne (INTOUCH, CINETPAY, ORANGE_DIRECT, etc.) est TRANSPARENT.
 * SahelPay choisit automatiquement le meilleur gateway selon le coût et la disponibilité.
 *
 * Le client ne voit que les méthodes de paiement, pas les gateways internes.
 */
class Capabilities
{
    /**
     * Méthodes de paiement supportées
     */
    public const PAYMENT_METHODS = [
        'ORANGE_MONEY',   // Orange Money (Mali, Sénégal, CI...)
        'WAVE',           // Wave (Sénégal, Mali, CI)
        'MOOV',           // Moov Money (Mali, Bénin, Togo)
        'CARD',           // Carte bancaire (VISA/Mastercard/GIM-UEMOA)
        'VISA',           // Carte VISA
        'MASTERCARD',     // Carte Mastercard
        'GIM_UEMOA',      // Carte régionale GIM-UEMOA
    ];

    /**
     * Capabilities disponibles
     */
    public const CAPABILITY_TYPES = [
        'payments',        // Paiements entrants
        'payment_links',   // Liens de paiement
        'qr_code',         // QR Code natif
        'payouts',         // Envoi d'argent
        'withdrawals',     // Retraits
        'opr',             // Request-to-pay
        'splits',          // Split payments
        'customer_portal', // Portail client
    ];

    /**
     * Matrice des capabilities par méthode de paiement
     */
    private const MATRIX = [
        'ORANGE_MONEY' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => true,
            'withdrawals' => true,
            'opr' => true,
            'splits' => false,
            'customer_portal' => false,
        ],
        'WAVE' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => true,
            'payouts' => true,
            'withdrawals' => true,
            'opr' => true,
            'splits' => false,
            'customer_portal' => false,
        ],
        'MOOV' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => true,
            'withdrawals' => true,
            'opr' => true,
            'splits' => false,
            'customer_portal' => false,
        ],
        'CARD' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => false,
            'withdrawals' => true,
            'opr' => false,
            'splits' => true,
            'customer_portal' => true,
        ],
        'VISA' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => false,
            'withdrawals' => true,
            'opr' => false,
            'splits' => true,
            'customer_portal' => true,
        ],
        'MASTERCARD' => [
            'payments' => true,
            'payment_links' => true,
            'qr_code' => false,
            'payouts' => false,
            'withdrawals' => true,
            'opr' => false,
            'splits' => true,
            'customer_portal' => true,
        ],
        'GIM_UEMOA' => [
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

    /**
     * Descriptions des capabilities
     */
    private const DESCRIPTIONS = [
        'ORANGE_MONEY' => [
            'payments' => 'Paiement via Orange Money',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non disponible',
            'payouts' => 'Envoi d\'argent vers Orange Money',
            'withdrawals' => 'Retrait vers Orange Money',
            'opr' => 'Request-to-pay via Push USSD',
            'splits' => 'Via SahelPay Split',
            'customer_portal' => 'Non disponible',
        ],
        'WAVE' => [
            'payments' => 'Paiement via Wave (QR + Push)',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'QR Code Wave natif',
            'payouts' => 'Envoi d\'argent via Wave',
            'withdrawals' => 'Retrait vers Wave',
            'opr' => 'Request-to-pay Wave',
            'splits' => 'Via SahelPay Split',
            'customer_portal' => 'Non disponible',
        ],
        'MOOV' => [
            'payments' => 'Paiement via Moov Money',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non disponible',
            'payouts' => 'Envoi d\'argent via Moov',
            'withdrawals' => 'Retrait vers Moov',
            'opr' => 'Request-to-pay via Push USSD',
            'splits' => 'Via SahelPay Split',
            'customer_portal' => 'Non disponible',
        ],
        'CARD' => [
            'payments' => 'Paiement par carte (3DS Secure)',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non applicable',
            'payouts' => 'Non supporté',
            'withdrawals' => 'Virement bancaire',
            'opr' => 'Non applicable',
            'splits' => 'Marketplace splits',
            'customer_portal' => 'Gestion des cartes',
        ],
        'VISA' => [
            'payments' => 'Paiement par carte VISA',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non applicable',
            'payouts' => 'Non supporté',
            'withdrawals' => 'Virement bancaire',
            'opr' => 'Non applicable',
            'splits' => 'Marketplace splits',
            'customer_portal' => 'Gestion des cartes',
        ],
        'MASTERCARD' => [
            'payments' => 'Paiement par Mastercard',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non applicable',
            'payouts' => 'Non supporté',
            'withdrawals' => 'Virement bancaire',
            'opr' => 'Non applicable',
            'splits' => 'Marketplace splits',
            'customer_portal' => 'Gestion des cartes',
        ],
        'GIM_UEMOA' => [
            'payments' => 'Paiement par carte GIM-UEMOA',
            'payment_links' => 'Liens de paiement SahelPay',
            'qr_code' => 'Non applicable',
            'payouts' => 'Non supporté',
            'withdrawals' => 'Virement bancaire',
            'opr' => 'Non applicable',
            'splits' => 'Via SahelPay Split',
            'customer_portal' => 'Non disponible',
        ],
    ];

    /**
     * Vérifier si une méthode de paiement supporte une capability
     */
    public static function has(string $method, string $capability): bool
    {
        return self::MATRIX[$method][$capability] ?? false;
    }

    /**
     * Obtenir toutes les capabilities d'une méthode
     */
    public static function get(string $method): ?array
    {
        return self::MATRIX[$method] ?? null;
    }

    /**
     * Obtenir la description d'une capability
     */
    public static function getDescription(string $method, string $capability): string
    {
        return self::DESCRIPTIONS[$method][$capability] ?? 'Non documenté';
    }

    /**
     * Lister les méthodes supportant une capability
     */
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

    /**
     * Obtenir toute la matrice
     */
    public static function getAll(): array
    {
        return self::MATRIX;
    }
}

