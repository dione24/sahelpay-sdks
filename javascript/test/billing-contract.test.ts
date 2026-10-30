import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

const api = JSON.parse(readFileSync(resolve('../contracts/billing-openapi.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(resolve('../test-vectors/billing/responses.json'), 'utf8'));
const options: ts.CompilerOptions = { strict:true, noEmit:true, target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.ESNext, moduleResolution:ts.ModuleResolutionKind.NodeJs, skipLibCheck:true };
const program = ts.createProgram(['src/index.ts'], options);
const checker = program.getTypeChecker();
const module = checker.getSymbolAtLocation(program.getSourceFile('src/index.ts')!)!;
const exported = new Map(checker.getExportsOfModule(module).map(s => [s.name, checker.getDeclaredTypeOfSymbol(s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s)]));
function deref(schema: any): any { return schema.$ref ? api.components.schemas[schema.$ref.split('/').pop()] : schema; }
function body(path: string, method='post') { return deref(api.paths[path][method].requestBody.content['application/json'].schema); }
function response(path: string, method='get'): any {
  const responses=api.paths[path][method].responses;
  return responses[Object.keys(responses).find(code=>code.startsWith('2'))!].content['application/json'].schema;
}
function typeOf(input: any): string {
  const schema=deref(input);
  let result: string;
  if ((schema.anyOf || schema.oneOf) && !schema.properties) result=(schema.anyOf??schema.oneOf).map(typeOf).join(' | ');
  else if (schema.enum) result=schema.enum.map((v: unknown)=>JSON.stringify(v)).join(' | ');
  else if (schema.type==='array') result=`Array<${typeOf(schema.items)}>`;
  else if (schema.properties) result=`{${Object.entries<any>(schema.properties).map(([key,value])=>`${JSON.stringify(key)}${(schema.required??[]).includes(key)?'':'?'}: ${typeOf(value)}`).join(';')}}`;
  else result=({string:'string',number:'number',integer:'number',boolean:'boolean',object:'Record<string, unknown>'} as Record<string,string>)[schema.type]??'unknown';
  return schema.nullable?`(${result}) | null`:result;
}
function compile(declarations: string) {
  const filename=resolve('test/__billing_fixture_contract__.ts');
  const host=ts.createCompilerHost(options);
  const original=host.getSourceFile.bind(host);
  host.getSourceFile=(name,lang,onError,shouldCreate)=>name===filename?ts.createSourceFile(name,`import type * as SDK from '../src/index';\n${declarations}`,lang):original(name,lang,onError,shouldCreate);
  const p=ts.createProgram([filename],options,host);
  expect(ts.getPreEmitDiagnostics(p).map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n'))).toEqual([]);
}
function requestContract(name: string, schema: any) {
  const model=exported.get(name)!;
  expect(model,name).toBeDefined();
  expect(model.getProperties().map(p=>p.name).filter(k=>k!=='idempotency_key').sort()).toEqual(Object.keys(schema.properties).sort());
  for (const key of Object.keys(schema.properties)) {
    expect(Boolean(model.getProperty(key)!.flags&ts.SymbolFlags.Optional),`${name}.${key}`).toBe(!(schema.required??[]).includes(key));
  }
}
/** Structural assignability alone ignores extra fields; also require every wire field. */
function responseFields(type: ts.Type, input: any, path: string) {
 const schema=deref(input);const model=checker.getNonNullableType(type);
 if(schema.anyOf||schema.oneOf){for(const part of schema.anyOf??schema.oneOf)responseFields(model,part,path);return;}
 if(schema.type==='array'){
  const item=checker.getIndexTypeOfType(model,ts.IndexKind.Number);
  expect(item,`${path} array`).toBeDefined();responseFields(item!,schema.items,`${path}[]`);return;
 }
 for(const [name,propertySchema] of Object.entries<any>(schema.properties??{})){
  const property=model.getProperty(name);
  expect(property,`${path}.${name} is missing from the SDK`).toBeDefined();
  responseFields(checker.getTypeOfSymbolAtLocation(property!,property!.valueDeclaration!),propertySchema,`${path}.${name}`);
 }
}
const mappings: Array<[string,string,string,string]> = [
 ['post','/v1/billing/plans','Plan','plan'],
 ['get','/v1/billing/plans','Plan[]','plans'],
 ['patch','/v1/billing/plans/{id}','{success:boolean}','plan_update'],
 ['delete','/v1/billing/plans/{id}','DeletePlanResult','plan_delete'],
 ['post','/v1/billing/plans/{id}/send-link','SendPlanLinkResult','send_link_paid'],
 ['get','/v1/billing/subscriptions','{subscriptions:SDK.Subscription[];pagination:SDK.CursorPagination}','subscriptions'],
 ['post','/v1/billing/subscriptions','Subscription','subscription'],
 ['get','/v1/billing/subscriptions/{id}','SubscriptionSnapshot','snapshot'],
 ['delete','/v1/billing/subscriptions/{id}','{success:boolean}','cancel'],
 ['post','/v1/billing/subscriptions/import','SubscriptionSnapshot','paid_snapshot'],
 ['post','/v1/billing/subscriptions/with-payment','CreateSubscriptionWithPaymentResult','trial_checkout'],
 ['get','/v1/billing/customers','{customers:SDK.Customer[];pagination:SDK.PagePagination}','customers'],
 ['post','/v1/billing/invoices','Invoice','invoice'],
 ['get','/v1/billing/invoices','Invoice[]','invoices'],
 ['get','/v1/billing/invoices/{id}','Invoice','invoice'],
 ['patch','/v1/billing/invoices/{id}/open','Invoice','invoice'],
 ['patch','/v1/billing/invoices/{id}/void','Invoice','invoice'],
 ['post','/v1/billing/invoices/{id}/payment-link','InvoicePaymentLinkResult','invoice_link'],
];

describe('current OpenAPI vs SDK contracts',()=>{
 it('covers every supported Billing operation, not a hand-picked subset',()=>{
  const actual=Object.entries<any>(api.paths).flatMap(([path,ops])=>Object.keys(ops).map(method=>`${method} ${path}`)).sort();
  expect(mappings.map(([method,path])=>`${method} ${path}`).sort()).toEqual(actual);
 });
 it('matches all request and query fields, including cursor options',()=>{
  const assertions: string[]=[];
  for (const [name,path,method] of [
   ['CreatePlanParams','/v1/billing/plans','post'],
   ['CustomerIdentity','/v1/billing/plans/{id}/send-link','post'],['CreateSubscriptionParams','/v1/billing/subscriptions','post'],
   ['CreateSubscriptionWithPaymentParams','/v1/billing/subscriptions/with-payment','post'],['ImportSubscriptionParams','/v1/billing/subscriptions/import','post'],
   ['CreateInvoiceParams','/v1/billing/invoices','post'],
  ]) { const schema=body(path,method);requestContract(name,schema);assertions.push(`declare const req${assertions.length}: SDK.${name}; const body${assertions.length}: ${typeOf(schema)} = req${assertions.length};`); }
  for (const [name,path] of [['ListPlansParams','plans'],['ListSubscriptionsParams','subscriptions'],['ListCustomersParams','customers'],['ListInvoicesParams','invoices']]) {
   const params=api.paths[`/v1/billing/${path}`].get.parameters.filter((p:any)=>p.in==='query');
   const schema={type:'object',properties:Object.fromEntries(params.map((p:any)=>[p.name,['page','limit','offset','take'].includes(p.name)?{type:'integer'}:p.schema]))};
   requestContract(name,schema);
   assertions.push(`declare const query${assertions.length}: SDK.${name}; const expected${assertions.length}: ${typeOf(schema)} = query${assertions.length};`);
  }
  compile(assertions.join('\n'));
 });
 it('accepts the complete server response schemas in exported SDK types',()=>{
  compile(mappings.map(([method,path,type],i)=>{
   const schema=response(path,method);
   const data=schema.properties.data??schema;
   const target=type.startsWith('{')?type:`SDK.${type}`;
   if(type.startsWith('{subscriptions')) {
    responseFields(exported.get('Subscription')!,data.properties.subscriptions.items,'Subscription');
    responseFields(exported.get('CursorPagination')!,data.properties.pagination,'Subscription.pagination');
   } else if(type.startsWith('{customers')) {
    responseFields(exported.get('Customer')!,data.properties.customers.items,'Customer');
    responseFields(exported.get('PagePagination')!,data.properties.pagination,'Customer.pagination');
   } else if(!type.startsWith('{')) {
    responseFields(exported.get(type.replace('[]',''))!,type.endsWith('[]')?data.items:data,type);
   }
   if(schema.properties.pagination) responseFields(exported.get(type==='Plan[]'?'CursorPagination':'InvoicePagination')!,schema.properties.pagination,`${path}.pagination`);
   return `declare const api${i}: ${typeOf(data)}; const sdk${i}: ${target}=api${i};`;
  }).join('\n'));
 });
 it('typechecks recorded fixture payloads and discriminated events',()=>{
  compile(mappings.map(([, ,type,key],i)=>{
   const value=fixtures[key].data??fixtures[key];
   return `const fixture${i}: ${type.startsWith('{')?type:`SDK.${type}`}=${JSON.stringify(value)};`;
  }).join('\n')+`\nconst events:SDK.WebhookEvent[]=${JSON.stringify(fixtures.events)};`);
 });
});

it('keeps all SDK release and user-agent versions consistent',async()=>{
 const {SDK_VERSION}=await import('../dist/index.mjs');
 expect(SDK_VERSION).toBe('1.3.0');
 expect(JSON.parse(readFileSync('package.json','utf8')).version).toBe(SDK_VERSION);
 for(const path of ['src/merchant.ts','../python/sahelpay/__init__.py','../python/sahelpay/client.py','../python/setup.py','../php/src/Config.php']) expect(readFileSync(path,'utf8')).toContain(SDK_VERSION);
});

it('records trial and paid grace separately',()=>{
 const trial=fixtures.snapshot.data,paid=fixtures.paid_snapshot.data;
 expect(trial).toMatchObject({status:'TRIALING',access_status:'TRIALING',grace_until:null,billing_anchor_at:trial.trial_end});
 expect(trial.trial_end).toBe(trial.current_period_end);
 expect(Date.parse(paid.current_period_start)).toBeGreaterThanOrEqual(Date.parse(paid.trial_end));
 expect(Date.parse(paid.grace_until)-Date.parse(paid.current_period_end)).toBe(3*86400000);
});


it('validates all response fixtures against OpenAPI, rejecting invalid mutations',()=>{
 const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
 function expand(value:any):any {
  if(Array.isArray(value)) return value.map(expand);
  return value && typeof value==='object'?Object.fromEntries(Object.entries(deref(value)).map(([k,v])=>[k,expand(v)])):value;
 }
 for(const [method,path,,key] of mappings){
  const validate=ajv.compile(expand(response(path,method)));
  expect(validate(fixtures[key]),`${method} ${path}: ${JSON.stringify(validate.errors)}`).toBe(true);
 }
 const sendLink=ajv.compile(expand(response('/v1/billing/plans/{id}/send-link','post')));
 expect(sendLink(fixtures.send_link_open),JSON.stringify(sendLink.errors)).toBe(true);
 const replay=ajv.compile(expand(response('/v1/billing/subscriptions/with-payment','post')));
 expect(replay(fixtures.paid_checkout_replay),JSON.stringify(replay.errors)).toBe(true);
 const validate=ajv.compile(expand(response('/v1/billing/subscriptions/{id}')));
 for(const mutate of [(x:any)=>{delete x.data.current_period_end;},(x:any)=>{x.data.access_status='PAID';},(x:any)=>{x.data.plan.amount='4000';}]){
  const broken=structuredClone(fixtures.snapshot);mutate(broken);expect(validate(broken)).toBe(false);
 }
});
