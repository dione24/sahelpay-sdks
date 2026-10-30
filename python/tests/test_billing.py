"""Replay recorded source-derived Billing responses without contacting the API."""
import json
import hashlib
import hmac
import time
import unittest
from pathlib import Path
from unittest.mock import patch
from sahelpay import Client
from sahelpay.billing import Plan, Subscription, InvoicePaidData
from typing import Any, get_type_hints, get_args

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / 'test-vectors/billing/responses.json').read_text())

class BillingTests(unittest.TestCase):
    def setUp(self):
        self.client = Client(secret_key='sk_test_PLACEHOLDER')

    def test_optional_phone_and_trial_period(self):
        for identity in ['customer_id', 'customer_external_ref', 'customer_email']:
            with self.subTest(identity=identity), patch.object(self.client, '_request', return_value=FIXTURES['subscription']) as req:
                result = self.client.subscriptions.create('plan_fixture', **{identity:'fixture'}, trial_end='2026-11-30T00:00:00Z', idempotency_key='create-fixture')
                self.assertEqual(result, FIXTURES['subscription']['data'])
                self.assertNotIn('customer_phone', req.call_args.args[2])
                self.assertNotIn('idempotency_key', req.call_args.args[2])
                self.assertEqual(req.call_args.kwargs['headers'], {'X-Idempotency-Key':'create-fixture'})

    def test_nullable_checkout_and_paid_replay(self):
        for key in ['trial_checkout', 'paid_checkout_replay']:
            with self.subTest(key=key), patch.object(self.client, '_request', return_value=FIXTURES[key]) as req:
                self.assertEqual(self.client.subscriptions.create_with_payment('plan_fixture', customer_external_ref='fixture_user', external_ref='checkout_fixture'), FIXTURES[key]['data'])
                self.assertEqual(req.call_args.args[1], '/v1/billing/subscriptions/with-payment')

    def test_retrieve_and_import(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['snapshot']) as req:
            self.assertEqual(self.client.subscriptions.retrieve('sub/fixture'), FIXTURES['snapshot']['data'])
            self.assertEqual(req.call_args.args[1], '/v1/billing/subscriptions/sub%2Ffixture')
            result = self.client.subscriptions.import_period('plan_fixture','checkout_fixture','fixture_user','2026-10-30T00:00:00Z','2026-11-30T00:00:00Z', idempotency_key='import-fixture')
            self.assertEqual(result, FIXTURES['snapshot']['data'])
            self.assertEqual(req.call_args.kwargs['headers'], {'X-Idempotency-Key':'import-fixture'})

    def test_customer_pagination_and_null_phone(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['customers']) as req:
            self.assertEqual(self.client.customers.list(search='external&ref', page=2, limit=1), FIXTURES['customers']['data'])
            self.assertIn('search=external%26ref', req.call_args.args[1])

    def test_invoice_pagination_outside_data(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['invoices']) as req:
            result = self.client.invoices.list(limit=1, offset=0)
            self.assertEqual(result, {'invoices':FIXTURES['invoices']['data'],'pagination':FIXTURES['invoices']['pagination']})
            self.assertIn('offset=0', req.call_args.args[1])

    def test_invoice_routes_and_header(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['invoice']) as req:
            self.assertEqual(self.client.invoices.create(subtotal=4000,total=4000,due_date='2026-11-30T00:00:00Z',lines=[],idempotency_key='invoice-fixture'),FIXTURES['invoice']['data'])
            self.assertEqual(req.call_args.kwargs['headers'], {'X-Idempotency-Key':'invoice-fixture'})
            for method, verb, suffix in [('retrieve','GET',''),('open','PATCH','/open'),('void','PATCH','/void'),('generate_payment_link','POST','/payment-link')]:
                getattr(self.client.invoices,method)('inv/fixture')
                self.assertEqual(req.call_args.args[:2],(verb,'/v1/billing/invoices/inv%2Ffixture'+suffix))

    def test_plan_identity_and_quarterly(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['plan']) as req:
            self.client.plans.create('Premium',4000,'QUARTERLY',idempotency_key='plan-fixture')
            self.assertEqual(req.call_args.args[2]['interval'],'QUARTERLY')
            self.client.plans.send_link('plan/fixture',customer_external_ref='fixture_user')
            self.assertEqual(req.call_args.args[2],{'customer_external_ref':'fixture_user'})

    def test_signed_events_preserve_mode_and_billing_payloads(self):
        for event in FIXTURES['events']:
            raw=json.dumps(event)
            stamp=str(int(time.time()))
            signature=hmac.new(b'whsec_FIXTURE',(stamp+'.'+raw).encode(),hashlib.sha256).hexdigest()
            header='t='+stamp+',v1='+signature
            result=self.client.webhooks.construct_event(raw,header,'whsec_FIXTURE')
            self.assertEqual(result.data,event['data'])
            self.assertIs(result.livemode,False)
            self.assertEqual(result.id,event['id'])

    def test_public_typed_dicts_cover_recorded_response_fields(self):
        def check(model, data):
            annotations = get_type_hints(model)
            self.assertLessEqual(set(data), set(annotations), model.__name__)
            self.assertLessEqual(model.__required_keys__, set(data), model.__name__)
            for key, value in data.items():
                if value is None and annotations[key] is not Any:
                    self.assertIn(type(None), get_args(annotations[key]), model.__name__ + '.' + key)
        check(Plan, FIXTURES['plan']['data'])
        check(Plan, FIXTURES['plans']['data'][0])
        check(Subscription, FIXTURES['subscription']['data'])
        check(Subscription, FIXTURES['subscriptions']['data']['subscriptions'][0])
        check(InvoicePaidData, next(e['data'] for e in FIXTURES['events'] if e['event'] == 'invoice.paid'))

    def test_subscription_list_preserves_list_specific_fields(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['subscriptions']):
            result = self.client.subscriptions.list()
            self.assertEqual(result, FIXTURES['subscriptions']['data'])
            self.assertIsNone(result['subscriptions'][0]['customer']['email'])

    def test_cursor_lists_preserve_envelopes_and_legacy_plan_arrays(self):
        for resource in ['plans', 'subscriptions', 'customers', 'invoices']:
            with self.subTest(resource=resource), patch.object(self.client, '_request', return_value=FIXTURES[resource]) as request:
                api=getattr(self.client, resource)
                result=api.list_page(take=1,cursor='cursor+fixture/=') if resource=='plans' else api.list(take=1,cursor='cursor+fixture/=')
                self.assertEqual(result['pagination']['next_cursor'],'cursor+fixture/=')
                self.assertIn('cursor=cursor%2Bfixture%2F%3D',request.call_args.args[1])
                self.assertIn('take=1',request.call_args.args[1])
        with patch.object(self.client, '_request', return_value={'success':True,'data':FIXTURES['plans']['data']}):
            self.assertEqual(self.client.plans.list(),FIXTURES['plans']['data'])
            self.assertNotIn('pagination',self.client.plans.list_page())

    def test_send_link_replay_and_empty_explicit_key(self):
        with patch.object(self.client, '_request', return_value=FIXTURES['send_link_paid']) as request:
            result=self.client.plans.send_link('plan_fixture',customer_external_ref='fixture_user',idempotency_key='')
            self.assertIsNone(result['payment_link'])
            self.assertEqual(result['invoice_status'],'PAID')
            self.assertEqual(request.call_args.kwargs['headers'],{'X-Idempotency-Key':''})
            self.assertNotIn('idempotency_key',request.call_args.args[2])
