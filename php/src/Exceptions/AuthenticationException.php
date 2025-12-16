<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception d'authentification (clé API invalide)
 */
class AuthenticationException extends SahelPayException
{
    public function __construct(string $message = 'Invalid API key', int $statusCode = 401)
    {
        parent::__construct($message, 'AUTHENTICATION_ERROR', $statusCode);
    }
}
