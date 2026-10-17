<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SahelPay\Config;
use SahelPay\Resources\Webhook;

/**
 * Parité de signature avec le serveur SahelPay : mêmes vecteurs que la suite
 * jest du serveur (src/webhook/webhook-signature.spec.ts), le CLI et les SDK
 * JavaScript / Python (sdks/test-vectors/webhook-signature.json).
 */
class WebhookSignatureParityTest extends TestCase
{
    private const NEVER_EXPIRES = 1000000000000;

    private static function vectors(): array
    {
        $path = __DIR__ . '/../../../test-vectors/webhook-signature.json';
        $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        return $data;
    }

    private function webhookFor(string $secret): Webhook
    {
        return new Webhook(new Config('sk_test_parity', 'pk_test_parity', $secret));
    }

    public function testAcceptsServerVectors(): void
    {
        foreach (self::vectors()['valid'] as $vector) {
            $this->assertTrue(
                $this->webhookFor($vector['secret'])->verify($vector['raw_body'], $vector['header'], self::NEVER_EXPIRES),
                $vector['name']
            );
        }
    }

    public function testRejectsInvalidVectors(): void
    {
        foreach (self::vectors()['invalid'] as $vector) {
            $this->assertFalse(
                $this->webhookFor($vector['secret'])->verify($vector['raw_body'], $vector['header'], self::NEVER_EXPIRES),
                $vector['name']
            );
        }
    }

    public function testRejectsReplayOutsideTolerance(): void
    {
        $vector = self::vectors()['valid'][0];
        $this->assertFalse($this->webhookFor($vector['secret'])->verify($vector['raw_body'], $vector['header']));
    }

    public function testAcceptsFreshSignatureComputedLikeTheWorker(): void
    {
        $secret = 'whsec_fresh';
        $body = '{"id":"evt_1","event":"payment.success","data":{"amount":4000}}';
        $timestamp = time();
        $header = sprintf('t=%d,v1=%s', $timestamp, hash_hmac('sha256', $timestamp . '.' . $body, $secret));
        $this->assertTrue($this->webhookFor($secret)->verify($body, $header));
    }
}
