<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use SahelPay\SahelPay;

final class BillingTest extends TestCase
{
    private function fixtures(): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../../test-vectors/billing/responses.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    private function client(array $responses, array &$history): SahelPay
    {
        $mock = new MockHandler(array_map(fn($body) => new Response(200, [], json_encode($body)), $responses));
        $stack = HandlerStack::create($mock);
        $stack->push(Middleware::history($history));
        return new SahelPay('sk_test_PLACEHOLDER', null, ['handler' => $stack, 'webhook_secret' => 'whsec_FIXTURE']);
    }

    public function testOptionalPhoneTrialAndHeader(): void
    {
        $f = $this->fixtures();
        foreach (['customer_id', 'customer_external_ref', 'customer_email'] as $identity) {
            $history = [];
            $client = $this->client([$f['subscription']], $history);
            $result = $client->subscriptions->create(['plan_id' => 'plan_fixture', $identity => 'fixture', 'trial_end' => '2026-11-30T00:00:00Z', 'idempotency_key' => 'create-fixture']);
            $this->assertSame($f['subscription']['data'], $result->getData());
            $body = json_decode((string) $history[0]['request']->getBody(), true);
            $this->assertArrayNotHasKey('customer_phone', $body);
            $this->assertArrayNotHasKey('idempotency_key', $body);
            $this->assertSame('create-fixture', $history[0]['request']->getHeaderLine('X-Idempotency-Key'));
        }
    }

    public function testNullableCheckoutAndCanonicalSnapshot(): void
    {
        $f = $this->fixtures();
        $history = [];
        $client = $this->client([$f['trial_checkout'], $f['paid_checkout_replay'], $f['snapshot'], $f['snapshot'], $f['cancel']], $history);
        foreach (['trial_checkout', 'paid_checkout_replay'] as $key) {
            $this->assertSame($f[$key]['data'], $client->subscriptions->createWithPayment(['plan_id' => 'plan_fixture', 'customer_external_ref' => 'fixture_user', 'external_ref' => 'checkout_fixture'])->getData());
        }
        $this->assertSame($f['snapshot']['data'], $client->subscriptions->retrieve('sub/fixture')->getData());
        $this->assertSame('/v1/billing/subscriptions/sub%2Ffixture', $history[2]['request']->getUri()->getPath());
        $client->subscriptions->importPeriod(['plan_id' => 'plan_fixture', 'external_ref' => 'checkout_fixture', 'customer_external_ref' => 'fixture_user', 'current_period_start' => '2026-10-30T00:00:00Z', 'current_period_end' => '2026-11-30T00:00:00Z']);
        $this->assertSame('/v1/billing/subscriptions/import', $history[3]['request']->getUri()->getPath());
        $this->assertTrue($client->subscriptions->cancel('sub_fixture')->isSuccessful());
        $this->assertSame('DELETE', $history[4]['request']->getMethod());
    }

    public function testInvoiceAndCustomerPagination(): void
    {
        $f = $this->fixtures();
        $history = [];
        $client = $this->client([$f['customers'], $f['invoices']], $history);
        $this->assertSame($f['customers']['data'], $client->customers->all(['search' => 'external&ref', 'page' => 2, 'limit' => 1])->getData());
        $response = $client->invoices->all(['limit' => 1, 'offset' => 0]);
        $this->assertSame($f['invoices']['data'], $response->getData());
        $this->assertSame($f['invoices']['pagination'], $response->getRawData()['pagination']);
        $this->assertStringContainsString('offset=0', $history[1]['request']->getUri()->getQuery());
    }

    public function testInvoiceMethodsAndPlanIdentity(): void
    {
        $f = $this->fixtures();
        $history = [];
        $client = $this->client(array_fill(0, 6, $f['invoice']), $history);
        $client->invoices->create(['subtotal' => 4000, 'total' => 4000, 'due_date' => '2026-11-30T00:00:00Z', 'lines' => [], 'idempotency_key' => 'invoice-fixture']);
        $this->assertSame('invoice-fixture', $history[0]['request']->getHeaderLine('X-Idempotency-Key'));
        foreach (['retrieve' => ['GET', ''], 'open' => ['PATCH', '/open'], 'void' => ['PATCH', '/void'], 'generatePaymentLink' => ['POST', '/payment-link']] as $method => [$verb, $suffix]) {
            $client->invoices->$method('inv/fixture');
            $entry = end($history);
            $this->assertSame($verb, $entry['request']->getMethod());
            $this->assertSame('/v1/billing/invoices/inv%2Ffixture' . $suffix, $entry['request']->getUri()->getPath());
        }
        $client->plans->sendLink('plan_fixture', ['customer_external_ref' => 'fixture_user']);
        $this->assertSame(['customer_external_ref' => 'fixture_user'], json_decode((string) $history[5]['request']->getBody(), true));
    }

    public function testSignedBillingEvents(): void
    {
        $history = [];
        $client = $this->client([], $history);
        foreach ($this->fixtures()['events'] as $event) {
            $raw = json_encode($event);
            $stamp = (string) time();
            $header = 't=' . $stamp . ',v1=' . hash_hmac('sha256', $stamp . '.' . $raw, 'whsec_FIXTURE');
            $this->assertTrue($client->webhooks->verify($raw, $header));
            $parsed = $client->webhooks->constructEvent($raw, $header);
            $this->assertSame($event['id'], $parsed->getId());
            $this->assertFalse($parsed->getLivemode());
            $this->assertSame($event['data'], $parsed->getBillingData());
            $this->assertFalse($client->webhooks->verify($raw . ' ', $header));
        }
    }
}
