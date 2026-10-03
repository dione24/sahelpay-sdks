<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use PHPUnit\Framework\TestCase;
use SahelPay\Capabilities;
use SahelPay\Exceptions\ValidationException;
use SahelPay\Resources\Withdrawal;
use SahelPay\Resources\WebhookEvent;
use SahelPay\SahelPay;

class ContractTest extends TestCase
{
    private function clientWith(array $responses, array &$history): SahelPay
    {
        $history = [];
        $mock = new MockHandler($responses);
        $stack = HandlerStack::create($mock);
        $stack->push(Middleware::history($history));

        return new SahelPay('sk_test_abc', null, ['handler' => $stack]);
    }

    private function jsonResponse(array $body, int $status = 200): GuzzleResponse
    {
        return new GuzzleResponse($status, ['Content-Type' => 'application/json'], json_encode($body));
    }

    public function testPaymentInitiateSendsItemsAndIdempotencyHeader(): void
    {
        $history = [];
        $sahelpay = $this->clientWith([
            $this->jsonResponse(['success' => true, 'data' => [
                'id' => 'pi_1',
                'status' => 'INITIATED',
                'checkout_url' => 'https://pay.sahelpay.ml/c/pi_1',
            ]]),
        ], $history);

        $payment = $sahelpay->payments->initiate([
            'amount' => 2500,
            'customer_phone' => '+22370000000',
            'client_reference' => 'order-1',
            'success_url' => 'https://shop.test/ok',
            'cancel_url' => 'https://shop.test/ko',
            'hosted_checkout' => true,
            'items' => [['product_id' => 'prod_1', 'quantity' => 2]],
            'idempotency_key' => 'order-1',
        ]);

        $this->assertCount(1, $history);
        $request = $history[0]['request'];
        $this->assertEquals('POST', $request->getMethod());
        $this->assertEquals('/v1/payments', $request->getUri()->getPath());
        $this->assertEquals('order-1', $request->getHeaderLine('X-Idempotency-Key'));
        $body = json_decode((string) $request->getBody(), true);
        $this->assertEquals([['product_id' => 'prod_1', 'quantity' => 2]], $body['items']);
        $this->assertEquals('order-1', $body['client_reference']);
        $this->assertEquals('https://shop.test/ok', $body['success_url']);
        $this->assertEquals('https://shop.test/ko', $body['cancel_url']);
        $this->assertTrue($body['hosted_checkout']);
        $this->assertEquals('https://pay.sahelpay.ml/c/pi_1', $payment->checkout_url);
    }

    public function testPaymentInitiateGeneratesIdempotencyKey(): void
    {
        $history = [];
        $sahelpay = $this->clientWith([
            $this->jsonResponse(['success' => true, 'data' => ['id' => 'pi_2']]),
        ], $history);

        $sahelpay->payments->initiate([
            'amount' => 1000,
            'customer_phone' => '+22370000000',
        ]);

        $this->assertMatchesRegularExpression(
            '/^sdk_/',
            $history[0]['request']->getHeaderLine('X-Idempotency-Key')
        );
    }

    public function testFourHundredRaisesValidationExceptionFromErrorEnvelope(): void
    {
        $history = [];
        $sahelpay = $this->clientWith([
            $this->jsonResponse([
                'success' => false,
                'error' => [
                    'code' => 'BAD_REQUEST',
                    'message' => 'amount must not be less than 100',
                    'details' => ['amount must not be less than 100'],
                ],
            ], 400),
        ], $history);

        try {
            $sahelpay->payments->initiate([
                'amount' => 10,
                'customer_phone' => '+22370000000',
            ]);
            $this->fail('Expected ValidationException');
        } catch (ValidationException $e) {
            $this->assertEquals('BAD_REQUEST', $e->getErrorCode());
            $this->assertEquals(400, $e->getHttpStatus());
            $this->assertEquals('amount must not be less than 100', $e->getMessage());
            $this->assertTrue($e->hasFieldError('amount'));
        }
    }

    public function testWithdrawalCreateContract(): void
    {
        $history = [];
        $sahelpay = $this->clientWith([
            $this->jsonResponse(['success' => true, 'data' => ['id' => 'wd_1']]),
        ], $history);

        $this->assertInstanceOf(Withdrawal::class, $sahelpay->withdrawals);

        $sahelpay->withdrawals->create([
            'amount' => 50000,
            'phone_number' => '+22370000000',
            'idempotency_key' => 'wd-1',
        ]);

        $request = $history[0]['request'];
        $this->assertEquals('POST', $request->getMethod());
        $this->assertEquals('/v1/withdrawals', $request->getUri()->getPath());
        $this->assertEquals('wd-1', $request->getHeaderLine('X-Idempotency-Key'));
        $this->assertEquals([
            'amount' => 50000,
            'phone_number' => '+22370000000',
            'provider' => 'ORANGE_MONEY',
        ], json_decode((string) $request->getBody(), true));
    }

    public function testBillingAndRefundsPaths(): void
    {
        $history = [];
        $ok = $this->jsonResponse(['success' => true, 'data' => ['id' => 'x']]);
        $sahelpay = $this->clientWith([$ok, $ok, $ok, $ok, $ok], $history);

        $sahelpay->plans->create(['name' => 'Premium', 'amount' => 10000, 'interval' => 'MONTHLY']);
        $sahelpay->subscriptions->createWithPayment([
            'plan_id' => 'plan_1',
            'customer_phone' => '+22370000000',
        ]);
        $sahelpay->customers->list(['search' => '7012', 'page' => 1, 'limit' => 20]);
        $sahelpay->refunds->create([
            'payment_id' => 'pi_1',
            'amount' => 1000,
            'idempotency_key' => 'rf-1',
        ]);
        $sahelpay->portal->createSession(['customer_phone' => '+22370000000']);

        $this->assertEquals('POST', $history[0]['request']->getMethod());
        $this->assertEquals('/v1/billing/plans', $history[0]['request']->getUri()->getPath());
        $this->assertEquals('/v1/billing/subscriptions/with-payment', $history[1]['request']->getUri()->getPath());
        $this->assertEquals('GET', $history[2]['request']->getMethod());
        $this->assertEquals('/v1/billing/customers', $history[2]['request']->getUri()->getPath());
        $this->assertStringContainsString('search=7012', $history[2]['request']->getUri()->getQuery());
        $this->assertEquals('/v1/refunds', $history[3]['request']->getUri()->getPath());
        $this->assertEquals('rf-1', $history[3]['request']->getHeaderLine('X-Idempotency-Key'));
        $this->assertFalse(method_exists($sahelpay->refunds, 'all'));
        $this->assertEquals('/v1/portal/sessions', $history[4]['request']->getUri()->getPath());
    }

    public function testCapabilitiesOrangeMoneyOnly(): void
    {
        $this->assertEquals(['ORANGE_MONEY'], Capabilities::PAYMENT_METHODS);
        $this->assertTrue(Capabilities::has('ORANGE_MONEY', 'payments'));
        $this->assertFalse(Capabilities::has('ORANGE_MONEY', 'payouts'));
        $this->assertTrue(Capabilities::has('ORANGE_MONEY', 'withdrawals'));
        $this->assertNull(Capabilities::get('WAVE'));
    }

    public function testWebhookEventExpiredAndClientReference(): void
    {
        $event = new WebhookEvent([
            'event' => 'payment.expired',
            'data' => [
                'id' => 'pi_1',
                'status' => 'EXPIRED',
                'client_reference' => 'order-9',
            ],
        ]);
        $this->assertTrue($event->isExpired());
        $this->assertFalse($event->isSuccess());
        $this->assertEquals('order-9', $event->getClientReference());
        $this->assertContains('payment.expired', WebhookEvent::EVENTS);
    }
}
