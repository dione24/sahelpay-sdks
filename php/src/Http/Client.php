<?php

declare(strict_types=1);

namespace SahelPay\Http;

use GuzzleHttp\Client as GuzzleClient;
use GuzzleHttp\Exception\RequestException;
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

    public function __construct(Config $config)
    {
        $this->config = $config;
        $this->http = new GuzzleClient([
            'base_uri' => $config->getBaseUrl(),
            'timeout' => $config->getTimeout(),
            'headers' => [
                'Authorization' => 'Bearer ' . $config->getSecretKey(),
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'User-Agent' => 'SahelPay-PHP/' . Config::VERSION,
            ],
        ]);
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
        return $this->request('POST', $endpoint, ['json' => $data], $headers);
    }

    /**
     * Effectuer une requête PUT
     */
    public function put(string $endpoint, array $data = [], array $headers = []): Response
    {
        return $this->request('PUT', $endpoint, ['json' => $data], $headers);
    }
    public function patch(string $endpoint, array $data = [], array $headers = []): Response
    {
        return $this->request('PATCH', $endpoint, ['json' => $data], $headers);
    }

    /**
     * Effectuer une requête DELETE
     */
    public function delete(string $endpoint, array $params = [], array $headers = []): Response
    {
        return $this->request('DELETE', $endpoint, ['query' => $params], $headers);
    }

    /**
     * Effectuer une requête HTTP
     */
    private function request(string $method, string $endpoint, array $options = [], array $headers = []): Response
    {
        try {
            if (!empty($headers)) {
                $options['headers'] = array_merge([
                    'Authorization' => 'Bearer ' . $this->config->getSecretKey(),
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'SahelPay-PHP/' . Config::VERSION,
                ], $headers);
            }

            $response = $this->http->request($method, '/v1' . $endpoint, $options);
            $body = json_decode($response->getBody()->getContents(), true);
            
            return new Response(
                $response->getStatusCode(),
                $body ?? [],
                $response->getHeaders()
            );
        } catch (RequestException $e) {
            $this->handleException($e);
        }
    }

    /**
     * Gérer les exceptions HTTP
     */
    private function handleException(RequestException $e): never
    {
        $response = $e->getResponse();
        $statusCode = $response ? $response->getStatusCode() : 0;
        $body = $response ? json_decode($response->getBody()->getContents(), true) : [];
        
        $message = $body['message'] ?? $e->getMessage();
        $code = $body['code'] ?? 'UNKNOWN_ERROR';

        match ($statusCode) {
            401 => throw new AuthenticationException($message, $statusCode),
            422 => throw new ValidationException($message, $body['errors'] ?? [], $statusCode),
            default => throw new ApiException($message, $code, $statusCode),
        };
    }
}