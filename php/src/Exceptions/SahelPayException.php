<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

use Exception;

/**
 * Exception de base pour le SDK SahelPay
 */
class SahelPayException extends Exception
{
    protected string $errorCode;

    public function __construct(string $message, string $code = 'SAHELPAY_ERROR', int $statusCode = 0)
    {
        $this->errorCode = $code;
        parent::__construct($message, $statusCode);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
