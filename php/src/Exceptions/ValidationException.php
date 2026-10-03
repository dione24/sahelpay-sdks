<?php

declare(strict_types=1);

namespace SahelPay\Exceptions;

/**
 * Exception de validation (paramètres invalides).
 *
 * Levée pour un 422 (code VALIDATION_ERROR) et pour les 400 de validation
 * du corps de requête : l'API renvoie alors le code BAD_REQUEST avec la
 * liste des messages dans `error.details`. getErrorCode() renvoie le code
 * réel de l'API.
 */
class ValidationException extends SahelPayException
{
    private array $errors;

    public function __construct(string $message, array $errors = [], int $statusCode = 422, string $code = 'VALIDATION_ERROR')
    {
        $this->errors = $errors;
        parent::__construct($message, $code, $statusCode, $errors);
    }

    /**
     * Obtenir les erreurs de validation (`error.details` de l'API).
     * Généralement une liste de messages, ex. ["amount must not be less than 100"].
     */
    public function getErrors(): array
    {
        return $this->errors;
    }

    /**
     * Obtenir les erreurs pour un champ spécifique.
     * Accepte les détails indexés par champ, ou une liste de messages
     * commençant par le nom du champ (format class-validator).
     */
    public function getFieldErrors(string $field): array
    {
        if (isset($this->errors[$field])) {
            return (array) $this->errors[$field];
        }

        $matches = [];
        foreach ($this->errors as $key => $error) {
            if (!is_int($key) || !is_string($error)) {
                continue;
            }
            if (str_starts_with($error, $field . ' ') || str_starts_with($error, $field . '.')) {
                $matches[] = $error;
            }
        }

        return $matches;
    }

    /**
     * Vérifier si un champ a des erreurs
     */
    public function hasFieldError(string $field): bool
    {
        return !empty($this->getFieldErrors($field));
    }
}
