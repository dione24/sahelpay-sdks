#!/usr/bin/env python3
"""Copy only supported Billing paths/schemas from the backend's OpenAPI artifact."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('openapi', type=Path)
parser.add_argument('--revision', required=True)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
api = json.loads(args.openapi.read_text())
prefixes = ('/v1/billing/plans', '/v1/billing/customers', '/v1/billing/subscriptions', '/v1/billing/invoices', '/v1/billing/reminders')
paths = {p: v for p, v in api['paths'].items() if p.startswith(prefixes)}
schemas = {}
def refs(value):
    if isinstance(value, dict):
        ref = value.get('$ref', '')
        if ref.startswith('#/components/schemas/'):
            name = ref.rsplit('/', 1)[1]
            if name not in schemas:
                schemas[name] = api['components']['schemas'][name]
                refs(schemas[name])
        for v in value.values():
            refs(v)
    elif isinstance(value, list):
        for v in value:
            refs(v)
refs(paths)
snapshot = dict(openapi=api['openapi'], source=dict(repository='dione24/sahelPay', revision=args.revision), paths=paths, components=dict(schemas=schemas))
target = Path(__file__).resolve().parents[1] / 'contracts/billing-openapi.json'
if args.check:
    old = json.loads(target.read_text())
    # Revision changes alone are harmless; path/schema drift must fail.
    if old['paths'] != paths or old['components'] != snapshot['components']:
        raise SystemExit('Billing OpenAPI drift: refresh snapshot, SDK types, fixtures and docs before releasing.')
    print('Billing OpenAPI matches the SDK snapshot')
else:
    target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print('Recorded', len(paths), 'Billing paths at', args.revision)
