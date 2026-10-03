<?php

declare(strict_types=1);

namespace SahelPay\Http;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;
use SahelPay\Config;
use SahelPay\Exceptions\ApiException;
use SahelPay\Exceptions\AuthenticationException;
use SahelPay\Exceptions\ValidationException;

/**
 * Client HTTP pour les appels API
 */
class Client
{
    private GuzzleClient $http;
    private Config $config;

    /**
     * @param callable|null $handler Handler Guzzle optionnel (ex. HandlerStack avec MockHandler pour les tests)
     */
    public function __construct(Config $config, ?callable $handler = null)
    {
        $this->config = $config;

        $options = [
            'base_uri' => $config->getBaseUrl(),
            'timeout' => $config->getTimeout(),
            'headers' => $this->defaultHeaders(),
        ];
        if ($handler !== null) {
            $options['handler'] = $handler;
        }

        $this->http = new GuzzleClient($options);
    }

    /**
     * Effectuer une requête GET
     */
    public function get(string $endpoint, array $params = [], array $headers = []): Response
    {
        return $this->request('GET', $endpoint, ['query' => $params], $headers);
    }

    /**
     * Effectuer une requête POST
     */
    public function post(string $endpoint, array $data = [], array $headers = []): Response
    {
        return $this->request('POST', $endpoint, ['json' => empty($data) ? new \stdClass() : $data], $headers);
    }

    /**
     * Effectuer une requête PUT
     */
    public function put(string $endpoint, array $data = [], array $headers = []): Response
    {
        return $this->request('PUT', $endpoint, ['json' => empty($data) ? new \stdClass() : $data], $headers);
    }

    /**
     * Effectuer une requête PATCH
     */
    public function patch(string $endpoint, array $data = [], array $headers = []): Response
    {
        return $this->request('PATCH', $endpoint, ['json' => empty($data) ? new \stdClass() : $data], $headers);
    }

    /**
     * Effectuer une requête DELETE
     */
    public function delete(string $endpoint, array $params = [], array $headers = []): Response
    {
        return $this->request('DELETE', $endpoint, ['query' => $params], $headers);
    }

    private function defaultHeaders(): array
    {
        return [
            'Authorization' => 'Bearer ' . $this->config->getSecretKey(),
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'User-Agent' => 'SahelPay-PHP/' . Config::VERSION,
        ];
    }

    /**
     * Effectuer une requête HTTP
     */
    private function request(string $method, string $endpoint, array $options = [], array $headers = []): Response
    {
        if (!empty($headers)) {
            $options['headers'] = array_merge($this->defaultHeaders(), $headers);
        }

        try {
            $response = $this->http->request($method, '/v1' . $endpoint, $options);
        } catch (RequestException $e) {
            if ($e->getResponse() !== null) {
                $this->throwFromResponse($e->getResponse());
            }
            throw new ApiException($e->getMessage(), 'NETWORK_ERROR', 0);
        } catch (GuzzleException $e) {
            // Erreurs de connexion / timeout : aucune réponse HTTP.
            throw new ApiException($e->getMessage(), 'NETWORK_ERROR', 0);
        }

        $body = json_decode((string) $response->getBody(), true);

        return new Response(
            $response->getStatusCode(),
            is_array($body) ? $body : [],
            $response->getHeaders()
        );
    }

    /**
     * Convertir une réponse d'erreur en exception typée.
     *
     * Format API : { success: false, error: { code, message, details?, http_status, path, timestamp } }
     * Repli sur l'ancien format à plat : { code, message, errors? }.
     */
    private function throwFromResponse(ResponseInterface $response): never
    {
        $statusCode = $response->getStatusCode();
        $decoded = json_decode((string) $response->getBody(), true);
        $body = is_array($decoded) ? $decoded : [];

        $error = isset($body['error']) && is_array($body['error']) ? $body['error'] : $body;

        $message = $error['message'] ?? $body['message'] ?? null;
        if (is_array($message)) {
            $message = (string) ($message[0] ?? 'Validation failed');
        }
        if (!is_string($message) || $message === '') {
            $message = $response->getReasonPhrase() ?: 'API Error';
        }

        $code = $error['code'] ?? $body['code'] ?? null;
        if (!is_string($code) || $code === '') {
            $code = 'UNKNOWN_ERROR';
        }

        $details = $error['details'] ?? $body['errors'] ?? $body['details'] ?? null;

        if ($statusCode === 401) {
            throw new AuthenticationException($message, 401, $code, $details);
        }

        $isValidation = $statusCode === 400
            || $statusCode === 422
            || $code === 'VALIDATION_ERROR';

        if ($isValidation) {
            throw new ValidationException($message, is_array($details) ? $details : [], $statusCode, $code);
        }

        throw new ApiException($message, $code, $statusCode, $details);
    }
}
