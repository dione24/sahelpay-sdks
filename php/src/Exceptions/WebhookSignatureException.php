<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception levée lors d'une erreur de vérification de signature webhook
 */
class WebhookSignatureException extends SahelPayException
{
    public function __construct(string $message)
    {
        parent::__construct($message, 'WEBHOOK_SIGNATURE_ERROR', 400);
    }
}