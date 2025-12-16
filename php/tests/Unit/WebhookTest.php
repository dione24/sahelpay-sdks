<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SahelPay\Config;
use SahelPay\Resources\Webhook;
use SahelPay\Resources\WebhookEvent;

class WebhookTest extends TestCase
{
    private Webhook $webhook;

    protected function setUp(): void
    {
        $config = new Config(
            'sk_test_abc',
            'pk_test_xyz',
            'whsec_testsecret123'
        );
        $this->webhook = new Webhook($config);
    }

    public function testCanVerifyValidSignature(): void
    {
        $payload = '{"event":"payment.success","data":{"reference_id":"SP-123"}}';
        $signature = hash_hmac('sha256', $payload, 'whsec_testsecret123');
        
        $this->assertTrue($this->webhook->verify($payload, $signature));
    }

    public function testRejectsInvalidSignature(): void
    {
        $payload = '{"event":"payment.success","data":{"reference_id":"SP-123"}}';
        $signature = 'invalid_signature';
        
        $this->assertFalse($this->webhook->verify($payload, $signature));
    }

    public function testCanParsePayload(): void
    {
        $payload = '{"event":"payment.success","data":{"reference_id":"SP-123","amount":5000}}';
        
        $event = $this->webhook->parse($payload);
        
        $this->assertInstanceOf(WebhookEvent::class, $event);
        $this->assertEquals('payment.success', $event->getType());
        $this->assertEquals('SP-123', $event->getReferenceId());
    }

    public function testEventIsSuccess(): void
    {
        $payload = '{"event":"payment.success","data":{"reference_id":"SP-123","status":"SUCCESS"}}';
        $event = $this->webhook->parse($payload);
        
        $this->assertTrue($event->isSuccess());
        $this->assertFalse($event->isFailed());
    }

    public function testEventIsFailed(): void
    {
        $payload = '{"event":"payment.failed","data":{"reference_id":"SP-123","status":"FAILED"}}';
        $event = $this->webhook->parse($payload);
        
        $this->assertTrue($event->isFailed());
        $this->assertFalse($event->isSuccess());
    }

    public function testThrowsExceptionForInvalidJson(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->webhook->parse('invalid json');
    }

    public function testThrowsExceptionWithoutWebhookSecret(): void
    {
        $config = new Config('sk_test_abc', 'pk_test_xyz');
        $webhook = new Webhook($config);
        
        $this->expectException(\RuntimeException::class);
        $webhook->verify('payload', 'signature');
    }
}
