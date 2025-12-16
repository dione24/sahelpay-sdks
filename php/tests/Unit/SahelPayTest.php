<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SahelPay\SahelPay;
use SahelPay\Config;
use SahelPay\Resources\Payment;
use SahelPay\Resources\PaymentLink;
use SahelPay\Resources\Payout;
use SahelPay\Resources\Transaction;
use SahelPay\Resources\Webhook;

class SahelPayTest extends TestCase
{
    private SahelPay $sahelpay;

    protected function setUp(): void
    {
        $this->sahelpay = new SahelPay(
            'sk_test_abc123',
            'pk_test_xyz789',
            ['webhook_secret' => 'whsec_secret123']
        );
    }

    public function testCanBeInstantiated(): void
    {
        $this->assertInstanceOf(SahelPay::class, $this->sahelpay);
    }

    public function testHasPaymentsResource(): void
    {
        $this->assertInstanceOf(Payment::class, $this->sahelpay->payments);
    }

    public function testHasPaymentLinksResource(): void
    {
        $this->assertInstanceOf(PaymentLink::class, $this->sahelpay->paymentLinks);
    }

    public function testHasPayoutsResource(): void
    {
        $this->assertInstanceOf(Payout::class, $this->sahelpay->payouts);
    }

    public function testHasTransactionsResource(): void
    {
        $this->assertInstanceOf(Transaction::class, $this->sahelpay->transactions);
    }

    public function testHasWebhooksResource(): void
    {
        $this->assertInstanceOf(Webhook::class, $this->sahelpay->webhooks);
    }

    public function testDetectsSandboxModeFromTestKey(): void
    {
        $sahelpay = new SahelPay('sk_test_abc', 'pk_test_xyz');
        $this->assertTrue($sahelpay->isSandbox());
    }

    public function testDetectsLiveModeFromLiveKey(): void
    {
        $sahelpay = new SahelPay('sk_live_abc', 'pk_live_xyz');
        $this->assertFalse($sahelpay->isSandbox());
    }

    public function testCanGetConfig(): void
    {
        $config = $this->sahelpay->getConfig();
        $this->assertInstanceOf(Config::class, $config);
        $this->assertEquals('sk_test_abc123', $config->getSecretKey());
        $this->assertEquals('pk_test_xyz789', $config->getPublicKey());
        $this->assertEquals('whsec_secret123', $config->getWebhookSecret());
    }
}
