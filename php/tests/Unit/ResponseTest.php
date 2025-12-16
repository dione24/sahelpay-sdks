<?php

declare(strict_types=1);

namespace SahelPay\Tests\Unit;

use PHPUnit\Framework\TestCase;
use SahelPay\Http\Response;

class ResponseTest extends TestCase
{
    public function testCanGetStatusCode(): void
    {
        $response = new Response(200, ['data' => ['id' => '123']]);
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testIsSuccessfulFor2xxCodes(): void
    {
        $response200 = new Response(200, []);
        $response201 = new Response(201, []);
        $response400 = new Response(400, []);
        
        $this->assertTrue($response200->isSuccessful());
        $this->assertTrue($response201->isSuccessful());
        $this->assertFalse($response400->isSuccessful());
    }

    public function testCanAccessDataViaProperty(): void
    {
        $response = new Response(200, [
            'data' => [
                'reference_id' => 'SP-123',
                'amount' => 5000,
            ]
        ]);
        
        $this->assertEquals('SP-123', $response->reference_id);
        $this->assertEquals(5000, $response->amount);
    }

    public function testCanConvertToArray(): void
    {
        $data = ['reference_id' => 'SP-123', 'amount' => 5000];
        $response = new Response(200, ['data' => $data]);
        
        $this->assertEquals($data, $response->toArray());
    }

    public function testCanConvertToJson(): void
    {
        $data = ['reference_id' => 'SP-123', 'amount' => 5000];
        $response = new Response(200, ['data' => $data]);
        
        $json = $response->toJson();
        $this->assertJson($json);
        
        $decoded = json_decode($json, true);
        $this->assertEquals('SP-123', $decoded['reference_id']);
    }

    public function testCanGetMessage(): void
    {
        $response = new Response(200, ['message' => 'Payment initiated']);
        $this->assertEquals('Payment initiated', $response->getMessage());
    }

    public function testCanCheckIfPropertyExists(): void
    {
        $response = new Response(200, [
            'data' => ['reference_id' => 'SP-123']
        ]);
        
        $this->assertTrue(isset($response->reference_id));
        $this->assertFalse(isset($response->unknown_property));
    }
}
