<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception d'authentification (clé API absente, invalide ou révoquée).
 * Code API habituel : UNAUTHORIZED.
 */
class AuthenticationException extends SahelPayException
{
    public function __construct(string $message = 'Invalid API key', int $statusCode = 401, string $code = 'UNAUTHORIZED', mixed $details = null)
    {
        parent::__construct($message, $code, $statusCode, $details);
    }
}
