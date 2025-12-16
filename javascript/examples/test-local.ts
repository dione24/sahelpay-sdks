/**
 * Test local du SDK JavaScript SahelPay
 * 
 * Usage:
 *   cd sdks/javascript
 *   npm install
 *   npm run build
 *   npx tsx examples/test-local.ts
 */

// Import depuis le build local
import SahelPay from '../src/index.js';

const API_KEY = 'sk_test_demo123'; // Clé de test
const BASE_URL = 'http://localhost:3000'; // Backend local

async function testSDK() {
  console.log('🚀 Test SDK JavaScript SahelPay\n');
  console.log('='.repeat(50));

  // Initialisation
  const sahelpay = new SahelPay({
    secretKey: API_KEY,
    environment: 'sandbox',
    baseUrl: BASE_URL,
  });

  console.log('✅ Client initialisé');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Mode: sandbox\n`);

  // Test 1: Lister les transactions
  console.log('📋 Test 1: Lister les transactions...');
  try {
    const { payments } = await sahelpay.payments.list({ limit: 5 });
    console.log(`   ✅ ${payments?.length || 0} transactions trouvées\n`);
  } catch (error: any) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 2: Lister les liens de paiement
  console.log('🔗 Test 2: Lister les liens de paiement...');
  try {
    const links = await sahelpay.paymentLinks.list();
    console.log(`   ✅ ${links?.length || 0} liens trouvés\n`);
  } catch (error: any) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 3: Stats Payouts
  console.log('💰 Test 3: Statistiques payouts...');
  try {
    const stats = await sahelpay.payouts.stats();
    console.log(`   ✅ Total: ${stats?.total || 0}`);
    console.log(`   ✅ Complétés: ${stats?.completed || 0}`);
    console.log(`   ✅ Volume: ${stats?.total_volume || 0} FCFA\n`);
  } catch (error: any) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // Test 4: Initier un paiement (simulation)
  console.log('💳 Test 4: Initier un paiement...');
  try {
    const payment = await sahelpay.payments.create({
      amount: 1000,
      provider: 'ORANGE_MONEY',
      customer_phone: '+22370000000',
      description: 'Test SDK JavaScript',
    });
    console.log(`   ✅ Paiement créé: ${payment.reference_id}`);
    console.log(`   ✅ Status: ${payment.status}`);
    console.log(`   ✅ USSD: ${payment.ussd_code || 'N/A'}\n`);
  } catch (error: any) {
    console.log(`   ⚠️ Erreur attendue (pas de marchand): ${error.message}\n`);
  }

  // Test 5: Webhook verification
  console.log('🔒 Test 5: Vérification signature webhook...');
  const testPayload = '{"event":"payment.success","data":{"amount":1000}}';
  const testSecret = 'whsec_test123';
  try {
    // Générer une signature valide
    const crypto = require('crypto');
    const validSig = crypto.createHmac('sha256', testSecret).update(testPayload).digest('hex');
    
    const isValid = sahelpay.webhooks.verifySignature(testPayload, validSig, testSecret);
    console.log(`   ✅ Signature valide: ${isValid}`);
    
    const isInvalid = sahelpay.webhooks.verifySignature(testPayload, 'bad_signature', testSecret);
    console.log(`   ✅ Signature invalide rejetée: ${!isInvalid}\n`);
  } catch (error: any) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  console.log('='.repeat(50));
  console.log('✅ Tests terminés!\n');
}

testSDK().catch(console.error);
