<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception de validation (paramètres invalides)
 */
class ValidationException extends SahelPayException
{
    private array $errors;

    public function __construct(string $message, array $errors = [], int $statusCode = 422)
    {
        $this->errors = $errors;
        parent::__construct($message, 'VALIDATION_ERROR', $statusCode);
    }

    /**
     * Obtenir les erreurs de validation
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Obtenir les erreurs pour un champ spécifique
     */
    public function getFieldErrors(string $field): array
    {
        return $this->errors[$field] ?? [];
    }

    /**
     * Vérifier si un champ a des erreurs
     */
    public function hasFieldError(string $field): bool
    {
        return isset($this->errors[$field]) && !empty($this->errors[$field]);
    }
}
