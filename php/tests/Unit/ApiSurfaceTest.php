<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use PHPUnit\Framework\TestCase;
use SahelPay\SahelPay;

/**
 * Contrats hors réseau des routes ajoutées en 1.1.0 (liens, webhooks, paiement sécurisé).
 */
class ApiSurfaceTest extends TestCase
{
    private function clientWith(int $count, array &$history, array $options = []): SahelPay
    {
        $history = [];
        $responses = [];
        for ($i = 0; $i < $count; $i++) {
            $responses[] = new GuzzleResponse(200, ['Content-Type' => 'application/json'], json_encode(['success' => true, 'data' => ['id' => 'x', 'slug' => 's']]));
        }
        $stack = HandlerStack::create(new MockHandler($responses));
        $stack->push(Middleware::history($history));

        return new SahelPay('sk_test_abc', null, $options + ['handler' => $stack]);
    }

    private function body(array $history, int $i = 0): array
    {
        return json_decode((string) $history[$i]['request']->getBody(), true) ?? [];
    }

    public function testPaymentLinkWithLegacyPriceIsFixedAmount(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(1, $history);
        $sahelpay->paymentLinks->create(['title' => 'T-shirt', 'price' => 5000]);

        $body = $this->body($history);
        $this->assertSame('FIXED', $body['amount_mode']);
        $this->assertSame(5000, $body['fixed_amount']);
    }

    public function testPaymentLinkWithoutAmountIsOpen(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(1, $history);
        $sahelpay->paymentLinks->create(['name' => 'Caisse', 'min_amount' => 500]);

        $this->assertSame('OPEN', $this->body($history)['amount_mode']);
    }

    public function testPaymentLinkUpdateDeleteAndById(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(3, $history);
        $sahelpay->paymentLinks->update('pl_1', ['name' => 'Nouveau']);
        $sahelpay->paymentLinks->delete('pl_1');
        $sahelpay->paymentLinks->retrieveById('pl_1');

        $this->assertSame(['PATCH', '/v1/payment-links/pl_1'], [$history[0]['request']->getMethod(), $history[0]['request']->getUri()->getPath()]);
        $this->assertSame(['DELETE', '/v1/payment-links/pl_1'], [$history[1]['request']->getMethod(), $history[1]['request']->getUri()->getPath()]);
        $this->assertSame('/v1/payment-links/by-id/pl_1', $history[2]['request']->getUri()->getPath());
        $this->assertSame('https://pay.sahelpay.africa/abc', $sahelpay->paymentLinks->getUrl('abc'));
    }

    public function testPaymentExpire(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(1, $history);
        $sahelpay->payments->expire('pi_1');

        $this->assertSame(['POST', '/v1/payments/pi_1/expire'], [$history[0]['request']->getMethod(), $history[0]['request']->getUri()->getPath()]);
    }

    public function testWebhookLogsEventsAndRetry(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(3, $history);
        $sahelpay->webhooks->logs(['status' => 'FAILED', 'limit' => 10]);
        $sahelpay->webhooks->retry('log_1');
        $sahelpay->webhooks->events(['limit' => 5]);

        $this->assertSame('/v1/webhooks/logs', $history[0]['request']->getUri()->getPath());
        parse_str($history[0]['request']->getUri()->getQuery(), $query);
        $this->assertSame(['status' => 'FAILED', 'limit' => '10'], $query);
        $this->assertSame(['POST', '/v1/webhooks/logs/log_1/retry'], [$history[1]['request']->getMethod(), $history[1]['request']->getUri()->getPath()]);
        $this->assertSame('/v1/webhooks/events', $history[2]['request']->getUri()->getPath());
    }

    public function testSecureOrderCreateSendsIdempotencyHeader(): void
    {
        $history = [];
        $sahelpay = $this->clientWith(2, $history);
        $sahelpay->secureOrders->create([
            'amount' => 15000,
            'description' => 'Robe wax',
            'customer_phone' => '+22370000000',
            'idempotency_key' => 'order-9',
        ]);
        $sahelpay->secureOrders->confirmDelivery('so_1', '482913');

        $this->assertSame('/v1/secure-orders', $history[0]['request']->getUri()->getPath());
        $this->assertSame('order-9', $history[0]['request']->getHeaderLine('X-Idempotency-Key'));
        $this->assertArrayNotHasKey('idempotency_key', $this->body($history));
        $this->assertSame('/v1/secure-orders/so_1/confirm-delivery', $history[1]['request']->getUri()->getPath());
        $this->assertSame(['code' => '482913'], $this->body($history, 1));
    }

    public function testBareBodyHmacIsRejected(): void
    {
        $sahelpay = new SahelPay('sk_test_abc', null, ['webhook_secret' => 'whsec_test']);
        $payload = '{"id":"evt_1","event":"payment.success"}';
        $legacy = hash_hmac('sha256', $payload, 'whsec_test');

        $this->assertFalse($sahelpay->webhooks->verify($payload, $legacy));
    }
}
