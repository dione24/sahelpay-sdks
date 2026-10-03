<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

use Exception;

/**
 * Exception de base pour le SDK SahelPay
 *
 * - getErrorCode()  : code métier stable renvoyé par l'API (`error.code`), ex. NOT_FOUND
 * - getCode()       : statut HTTP (0 si erreur réseau)
 * - getDetails()    : `error.details` si présent (ex. messages de validation)
 */
class SahelPayException extends Exception
{
    protected string $errorCode;
    protected mixed $details;

    public function __construct(string $message, string $code = 'SAHELPAY_ERROR', int $statusCode = 0, mixed $details = null)
    {
        $this->errorCode = $code;
        $this->details = $details;
        parent::__construct($message, $statusCode);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    /**
     * Statut HTTP de la réponse (alias lisible de getCode()).
     */
    public function getHttpStatus(): int
    {
        return (int) $this->getCode();
    }

    /**
     * Détails fournis par l'API (`error.details`), ou null.
     */
    public function getDetails(): mixed
    {
        return $this->details;
    }
}
