<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception API générique
 */
class ApiException extends SahelPayException
{
    public function __construct(string $message, string $code = 'API_ERROR', int $statusCode = 0)
    {
        parent::__construct($message, $code, $statusCode);
    }
}
