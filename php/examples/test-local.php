<?php
/**
 * Test local du SDK PHP SahelPay
 * 
 * Usage:
 *   cd sdks/php
 *   composer install
 *   php examples/test-local.php
 */

require_once __DIR__ . '/../vendor/autoload.php';

use SahelPay\SahelPay;
use SahelPay\Exceptions\SahelPayException;

$API_KEY = 'sk_test_demo123';  // Clé de test
$PUBLIC_KEY = 'pk_test_demo123';  // Clé publique
$BASE_URL = 'http://localhost:3000';  // Backend local

function testSDK(): void
{
    global $API_KEY, $PUBLIC_KEY, $BASE_URL;

    echo "🚀 Test SDK PHP SahelPay\n\n";
    echo str_repeat('=', 50) . "\n";

    // Initialisation
    $sahelpay = new SahelPay($API_KEY, $PUBLIC_KEY, [
        'sandbox' => true,
        'base_url' => $BASE_URL,
    ]);

    echo "✅ Client initialisé\n";
    echo "   Base URL: $BASE_URL\n";
    echo "   Mode: sandbox\n\n";

    // Test 1: Lister les transactions
    echo "📋 Test 1: Lister les transactions...\n";
    try {
        $result = $sahelpay->payments->all(['limit' => 5]);
        $payments = $result->getData()['transactions'] ?? [];
        echo "   ✅ " . count($payments) . " transactions trouvées\n\n";
    } catch (SahelPayException $e) {
        echo "   ❌ Erreur: " . $e->getMessage() . "\n\n";
    }

    // Test 2: Lister les liens de paiement
    echo "🔗 Test 2: Lister les liens de paiement...\n";
    try {
        $result = $sahelpay->paymentLinks->all();
        $links = $result->getData() ?? [];
        echo "   ✅ " . count($links) . " liens trouvés\n\n";
    } catch (SahelPayException $e) {
        echo "   ❌ Erreur: " . $e->getMessage() . "\n\n";
    }

    // Test 3: Stats Payouts
    echo "💰 Test 3: Statistiques payouts...\n";
    try {
        $stats = $sahelpay->payouts->stats();
        $data = $stats->getData();
        echo "   ✅ Total: " . ($data['total'] ?? 0) . "\n";
        echo "   ✅ Complétés: " . ($data['completed'] ?? 0) . "\n";
        echo "   ✅ Volume: " . ($data['total_volume'] ?? 0) . " FCFA\n\n";
    } catch (SahelPayException $e) {
        echo "   ❌ Erreur: " . $e->getMessage() . "\n\n";
    }

    // Test 4: Initier un paiement (simulation)
    echo "💳 Test 4: Initier un paiement...\n";
    try {
        $payment = $sahelpay->payments->initiate([
            'amount' => 1000,
            'provider' => 'ORANGE_MONEY',
            'customer_phone' => '+22370000000',
            'description' => 'Test SDK PHP',
            'sandbox' => true,
        ]);
        echo "   ✅ Paiement créé: " . $payment->reference_id . "\n";
        echo "   ✅ Status: " . $payment->status . "\n";
        echo "   ✅ USSD: " . ($payment->ussd_code ?? 'N/A') . "\n\n";
    } catch (SahelPayException $e) {
        echo "   ⚠️ Erreur attendue (pas de marchand): " . $e->getMessage() . "\n\n";
    }

    // Test 5: Webhook verification
    echo "🔒 Test 5: Vérification signature webhook...\n";
    $testPayload = '{"event":"payment.success","data":{"amount":1000}}';
    $testSecret = 'whsec_test123';
    try {
        // Créer un nouveau client avec webhook secret
        $sahelpayWithWebhook = new SahelPay($API_KEY, $PUBLIC_KEY, [
            'sandbox' => true,
            'base_url' => $BASE_URL,
            'webhook_secret' => $testSecret,
        ]);

        // Générer une signature valide
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $testPayload, $testSecret);
        $validSig = "t={$timestamp},v1={$signature}";

        $isValid = $sahelpayWithWebhook->webhooks->verify($testPayload, $validSig);
        echo "   ✅ Signature valide: " . ($isValid ? 'true' : 'false') . "\n";

        try {
            $sahelpayWithWebhook->webhooks->verify($testPayload, 't=123,v1=bad_signature');
            echo "   ❌ Signature invalide acceptée\n\n";
        } catch (\Exception $e) {
            echo "   ✅ Signature invalide rejetée\n\n";
        }
    } catch (\Exception $e) {
        echo "   ❌ Erreur: " . $e->getMessage() . "\n\n";
    }

    echo str_repeat('=', 50) . "\n";
    echo "✅ Tests terminés!\n\n";
}

testSDK();
