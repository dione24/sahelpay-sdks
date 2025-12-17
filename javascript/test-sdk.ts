/**
 * Test du SDK SahelPay - JavaScript/TypeScript
 * 
 * Ce script teste les nouvelles fonctionnalités:
 * - Plans
 * - Subscriptions
 * - Customers
 */

import SahelPay from './src/index';

const SECRET_KEY = 'sk_live_6w4-GBVyES5vO9BDD7ewa2iXO6FRjkW8';

async function testSDK() {
  console.log('🚀 Test du SDK SahelPay JavaScript\n');
  console.log('='.repeat(50));

  const sahelpay = new SahelPay({
    secretKey: SECRET_KEY,
    environment: 'production',
  });

  try {
    // ==================== TEST PLANS ====================
    console.log('\n📋 TEST: Plans API');
    console.log('-'.repeat(30));

    // Lister les plans existants
    console.log('→ Listing des plans...');
    const plans = await sahelpay.plans.list();
    console.log(`✅ ${plans.length} plan(s) trouvé(s)`);
    plans.forEach(p => console.log(`   - ${p.name}: ${p.amount} XOF/${p.interval}`));

    // Créer un nouveau plan
    console.log('\n→ Création d\'un plan de test...');
    const newPlan = await sahelpay.plans.create({
      name: `SDK Test Plan ${Date.now()}`,
      amount: 2500,
      interval: 'MONTHLY',
    });
    console.log(`✅ Plan créé: ${newPlan.id}`);
    console.log(`   Nom: ${newPlan.name}`);
    console.log(`   Montant: ${newPlan.amount} ${newPlan.currency}`);

    // ==================== TEST SUBSCRIPTIONS ====================
    console.log('\n📅 TEST: Subscriptions API');
    console.log('-'.repeat(30));

    // Lister les abonnements
    console.log('→ Listing des abonnements...');
    const subsResult = await sahelpay.subscriptions.list();
    console.log(`✅ ${subsResult.subscriptions?.length || 0} abonnement(s) trouvé(s)`);

    // Créer un abonnement de test
    console.log('\n→ Création d\'un abonnement de test...');
    const newSub = await sahelpay.subscriptions.create({
      plan_id: newPlan.id,
      customer_phone: '22370000002',
    });
    console.log(`✅ Abonnement créé: ${newSub.id}`);
    console.log(`   Plan: ${newSub.plan_name}`);
    console.log(`   Client: ${newSub.customer_phone}`);
    console.log(`   Statut: ${newSub.status}`);
    console.log(`   Prochaine facturation: ${newSub.next_billing_date}`);

    // ==================== TEST CUSTOMERS ====================
    console.log('\n👥 TEST: Customers API');
    console.log('-'.repeat(30));

    // Lister les clients
    console.log('→ Listing des clients...');
    const customersResult = await sahelpay.customers.list();
    console.log(`✅ ${customersResult.customers?.length || 0} client(s) trouvé(s)`);

    // ==================== TEST PAYMENT LINKS ====================
    console.log('\n🔗 TEST: Payment Links API');
    console.log('-'.repeat(30));

    console.log('→ Listing des liens de paiement...');
    const links = await sahelpay.paymentLinks.list();
    console.log(`✅ ${links.length} lien(s) de paiement trouvé(s)`);

    // ==================== TEST PAYMENTS ====================
    console.log('\n💳 TEST: Payments API');
    console.log('-'.repeat(30));

    console.log('→ Listing des paiements...');
    const paymentsResult = await sahelpay.payments.list({ limit: 5 });
    console.log(`✅ ${paymentsResult.payments.length} paiement(s) récent(s)`);

    // ==================== RÉSUMÉ ====================
    console.log('\n' + '='.repeat(50));
    console.log('✅ TOUS LES TESTS PASSÉS AVEC SUCCÈS!');
    console.log('='.repeat(50));

  } catch (error: any) {
    console.error('\n❌ ERREUR:', error.message);
    if (error.code) console.error('   Code:', error.code);
    if (error.statusCode) console.error('   Status:', error.statusCode);
  }
}

testSDK();
