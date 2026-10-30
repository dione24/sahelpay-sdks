import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const api = JSON.parse(readFileSync(resolve('../contracts/billing-openapi.json'), 'utf8'));
const program = ts.createProgram(['src/index.ts'], { strict: true, target: ts.ScriptTarget.ES2020, moduleResolution: ts.ModuleResolutionKind.NodeJs, skipLibCheck: true });
const checker = program.getTypeChecker();
const module = checker.getSymbolAtLocation(program.getSourceFile('src/index.ts')!)!;
const exported = new Map(checker.getExportsOfModule(module).map(s => [s.name, checker.getDeclaredTypeOfSymbol(s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)]));
function schemaAt(path: string, method = 'post'): any {
  const schema = api.paths[path][method].requestBody.content['application/json'].schema;
  return schema.$ref ? api.components.schemas[schema.$ref.split('/').pop()] : schema;
}
function assertContract(name: string, schema: any) {
  const type = exported.get(name)!;
  expect(type, name).toBeDefined();
  const keys = Object.keys(schema.properties ?? {});
  // OpenAPI gaps are explicitly documented; do not turn empty schemas into proof.
  expect(keys.length, `${name}: missing OpenAPI properties`).toBeGreaterThan(0);
  expect(type.getProperties().map(p => p.name).filter(k => k !== 'idempotency_key').sort()).toEqual(keys.sort());
  for (const [key, spec] of Object.entries<any>(schema.properties)) {
    const property = type.getProperty(key)!;
    expect(Boolean(property.flags & ts.SymbolFlags.Optional), `${name}.${key} optional`).toBe(!(schema.required ?? []).includes(key));
    const value = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration!);
    const members = (value.isUnion() ? value.types : [value]).filter(t => !(t.flags & ts.TypeFlags.Undefined));
    if (spec.enum) {
      expect(members.map(t => (t as ts.StringLiteralType).value).sort(), `${name}.${key} enum`).toEqual([...spec.enum].sort());
    } else if (spec.type === 'string' || spec.type === 'number' || spec.type === 'integer' || spec.type === 'boolean') {
      const flags = spec.type === 'string' ? ts.TypeFlags.StringLike : spec.type === 'boolean' ? ts.TypeFlags.BooleanLike : ts.TypeFlags.NumberLike;
      expect(members.every(t => Boolean(t.flags & flags)), `${name}.${key} primitive`).toBe(true);
    }
  }
}

describe('exported Billing types vs recorded backend OpenAPI', () => {
  it('create subscription fields and optional identity', () => assertContract('CreateSubscriptionParams', schemaAt('/v1/billing/subscriptions')));
  it('checkout fields and optional trial', () => {
    const schema = structuredClone(schemaAt('/v1/billing/subscriptions/with-payment'));
    // Controller ships external_ref before OpenAPI catches up (contracts/README).
    schema.properties.external_ref ??= { type: 'string' };
    assertContract('CreateSubscriptionWithPaymentParams', schema);
  });
  it('send-link supports all documented identities', () => assertContract('CustomerIdentity', schemaAt('/v1/billing/plans/{id}/send-link')));
  it('invoice filters match OpenAPI and status enums', () => {
    const params = api.paths['/v1/billing/invoices'].get.parameters;
    assertContract('ListInvoicesParams', { properties: Object.fromEntries(params.map((p: any) => [p.name, ['limit','offset'].includes(p.name) ? {type:'number'} : p.schema])) });
  });
  it('all implemented routes exist in OpenAPI or the documented controller gap', () => {
    for (const [method, path] of [
      ['post','/v1/billing/plans'], ['patch','/v1/billing/plans/{id}'], ['delete','/v1/billing/plans/{id}'],
      ['get','/v1/billing/customers'], ['get','/v1/billing/subscriptions'], ['delete','/v1/billing/subscriptions/{id}'],
      ['post','/v1/billing/invoices'], ['get','/v1/billing/invoices/{id}'], ['patch','/v1/billing/invoices/{id}/open'],
      ['patch','/v1/billing/invoices/{id}/void'], ['post','/v1/billing/invoices/{id}/payment-link'],
    ]) expect(api.paths[path]?.[method], `${method} ${path}`).toBeDefined();
  });
});

it('typechecks recorded responses and discriminated webhook payloads against public exports', () => {
  const fixtures = JSON.parse(readFileSync(resolve('../test-vectors/billing/responses.json'), 'utf8'));
  const declarations = [
    ['Plan','plan'], ['Subscription','subscription'], ['SubscriptionSnapshot','snapshot'],
    ['CreateSubscriptionWithPaymentResult','trial_checkout'], ['CreateSubscriptionWithPaymentResult','paid_checkout_replay'],
    ['Invoice','invoice'],
  ].map(([type, key], i) => `const response${i}: SDK.${type} = ${JSON.stringify(fixtures[key].data)};`).join('\n')
    + `\nconst events: SDK.WebhookEvent[] = ${JSON.stringify(fixtures.events)};`;
  const filename = resolve('test/__billing_fixture_contract__.ts');
  const source = `import type * as SDK from '../src/index';\n${declarations}`;
  const options: ts.CompilerOptions = { strict:true, noEmit:true, target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.NodeJs, skipLibCheck:true };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, lang, onError, shouldCreate) => name === filename ? ts.createSourceFile(name, source, lang) : getSourceFile(name, lang, onError, shouldCreate);
  const fixtureProgram = ts.createProgram([filename], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(fixtureProgram);
  expect(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});


it('keeps release and HTTP user-agent versions consistent across SDKs', async () => {
  const { SDK_VERSION } = await import('../dist/index.mjs');
  expect(SDK_VERSION).toBe('1.2.0');
  expect(JSON.parse(readFileSync('package.json','utf8')).version).toBe(SDK_VERSION);
  for (const path of ['src/merchant.ts','../python/sahelpay/__init__.py','../python/sahelpay/client.py','../python/setup.py','../php/src/Config.php']) {
    const source=readFileSync(path,'utf8');
    expect(source).toContain(SDK_VERSION);
    expect(source).not.toContain('1.1.0');
  }
});
