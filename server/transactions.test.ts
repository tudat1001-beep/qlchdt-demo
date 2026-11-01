import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { bootstrapManager } from './auth.js';
import { createPool,type Database } from './db.js';
import { migrate } from './migrations.js';

let admin:Database|undefined;
let pool:Database;
let app:FastifyInstance;
let cookie:string;
let actor:string;
let supplier:string;
let customer:string;
let schemaCreated=false;
let imeiCounter=100000000000000n;
const schema=`test_${randomUUID().replaceAll('-','')}`;
const origin='http://127.0.0.1:5174';
const headers=(key:string=randomUUID()) => ({cookie,origin,'idempotency-key':key});
const imei=() => (++imeiCounter).toString();
const post=(url:string,payload:unknown,key?:string) => app.inject({method:'POST',url,headers:headers(key),payload:payload as object});
const patch=(url:string,payload:unknown,key?:string) => app.inject({method:'PATCH',url,headers:headers(key),payload:payload as object});
const get=(url:string) => app.inject({url,headers:{cookie}});
async function product(kind:'PHONE'|'ACCESSORY'='ACCESSORY') {
  const response=await post('/api/products',{sku:randomUUID(),name:`Test ${kind}`,kind,sale_price:500});
  expect(response.statusCode,response.body).toBe(201);
  return response.json();
}
async function purchase(lines:unknown[],extra_cost=0,payments:unknown[]=[],key?:string) {
  return post('/api/purchases',{supplier_id:supplier,extra_cost,lines,payments},key);
}
const sale=(lines:unknown[],payments:unknown[]=[],discount=0,customer_id:string|null=customer,key?:string) =>
  post('/api/sales',{lines,payments,discount,customer_id},key);
async function receiveAccessory(quantity=1,unit_cost=10) {
  const item=await product();
  const response=await purchase([{product_id:item.id,quantity,unit_cost}]);
  expect(response.statusCode,response.body).toBe(201);
  return item;
}
async function receivePhone() {
  const item=await product('PHONE');
  const response=await purchase([{product_id:item.id,quantity:1,unit_cost:30,devices:[{imei:imei(),condition:'USED'}]}]);
  expect(response.statusCode,response.body).toBe(201);
  return {...item,device:response.json().lines[0].devices[0]};
}
async function ledgerCounts() {
  const result:Record<string,number>={};
  for (const table of ['sales','sale_lines','sale_allocations','returns','return_lines','return_allocations','purchases','purchase_returns','purchase_return_lines','purchase_return_devices','purchase_return_allocations','stock_movements','payments','cash_entries','warranties','audit_logs','idempotency'])
    result[table]=(await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count;
  return result;
}

beforeAll(async () => {
  const url=process.env.TEST_DATABASE_URL;
  if (!url || !decodeURIComponent(new URL(url).pathname.slice(1)).endsWith('_test')) throw new Error('Dedicated _test database required');
  admin=createPool(url);
  if (!(await admin.query('SELECT current_database() AS name')).rows[0].name.endsWith('_test')) throw new Error('Refusing non-test database');
  await admin.query(`CREATE SCHEMA ${schema}`); schemaCreated=true;
  pool=createPool(url,{options:`-c search_path=${schema},public`});
  await migrate(pool);
  await bootstrapManager(pool,'transactions-test','test-password-only-123!');
  app=await buildApp({pool,origin});
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{username:'transactions-test',password:'test-password-only-123!'}});
  expect(login.statusCode).toBe(200);
  cookie=login.headers['set-cookie']!.toString().split(';')[0]; actor=login.json().id;
  supplier=(await post('/api/suppliers',{name:'Transaction supplier'})).json().id;
  customer=(await post('/api/customers',{name:'Transaction customer'})).json().id;
});
afterAll(async () => {
  await app?.close(); await pool?.end();
  if (admin) {
    if (schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
});

describe('inventory posting',() => {
  it('conserves every extra-cost dong across devices, repeated cost lines and at most two accessory lots per line',async () => {
    const phone=await product('PHONE'); const accessory=await product();
    const response=await purchase([
      {product_id:phone.id,quantity:1,unit_cost:10,devices:[{imei:imei(),condition:'USED',battery:81}]},
      {product_id:phone.id,quantity:1,unit_cost:20,devices:[{imei:imei(),condition:'NEW',sale_price:99}]},
      {product_id:accessory.id,quantity:3,unit_cost:5},
      {product_id:accessory.id,quantity:2,unit_cost:7},
    ],10,[{method:'cash',amount:20},{method:'bank',amount:30}]);
    expect(response.statusCode,response.body).toBe(201);
    const doc=response.json();
    expect(doc).toMatchObject({total:69,paid:50,debt:19,status:'posted',supplier_name:'Transaction supplier'});
    expect(doc.lines.map((line:any) => line.extra_cost)).toEqual([2,2,4,2]);
    expect(doc.lines.map((line:any) => line.cost)).toEqual([12,22,19,16]);
    expect(doc.lines[0].devices[0]).toMatchObject({cost:12,battery:81,sale_price:500});
    expect(doc.lines[1].devices[0]).toMatchObject({cost:22,sale_price:99});
    expect(doc.lines[2].lots.map((lot:any) => [lot.quantity,lot.unit_cost])).toEqual([[1,7],[2,6]]);
    expect(doc.lines[3].lots.map((lot:any) => [lot.quantity,lot.unit_cost])).toEqual([[2,8]]);
    const movement=(await pool.query('SELECT sum(cost)::bigint AS cost,sum(quantity)::bigint AS quantity FROM stock_movements WHERE purchase_line_id=ANY($1::uuid[])',[doc.lines.map((line:any) => line.id)])).rows[0];
    expect(movement).toEqual({cost:69,quantity:7});
    expect((await pool.query('SELECT c.direction,c.method,c.amount FROM cash_entries c JOIN payments p ON p.id=c.payment_id WHERE p.purchase_id=$1 ORDER BY c.amount',[doc.id])).rows).toEqual([
      {direction:'out',method:'cash',amount:20},{direction:'out',method:'bank',amount:30},
    ]);
    expect((await get(`/api/products?q=${accessory.sku}`)).json().items[0].stock_quantity).toBe(5);
    expect((await get(`/api/products?q=${phone.sku}`)).json().items[0].stock_quantity).toBe(2);
    const detail=(await get(`/api/purchases/${doc.id}`)).json();
    expect(detail).toEqual(doc);
    expect((await get('/api/purchases')).json().items.some((item:any) => item.id===doc.id)).toBe(true);
    expect((await get('/api/stock-movements')).json().items.filter((item:any) => item.reference_id===doc.id)).toHaveLength(5);
    const party=(await get(`/api/suppliers/${supplier}`)).json();
    expect(party.debt).toBe(19); expect(party.purchases).toHaveLength(1); expect(party.payments).toHaveLength(2);
    const patch=await app.inject({method:'PATCH',url:`/api/suppliers/${supplier}`,headers:headers(),payload:{note:'Debt preserved'}});
    expect(patch.json().debt).toBe(19);
  });
  it('rejects duplicate existing IMEI atomically, including a conflict after an earlier device insert',async () => {
    const phone=await product('PHONE'); const usedImei=imei();
    expect((await purchase([{product_id:phone.id,quantity:1,unit_cost:10,devices:[{imei:usedImei,condition:'NEW'}]}])).statusCode).toBe(201);
    const freshImei=imei(); const key=randomUUID();
    const before=(await pool.query('SELECT count(*) FROM purchases')).rows[0].count;
    const response=await purchase([{product_id:phone.id,quantity:2,unit_cost:10,devices:[{imei:freshImei,condition:'NEW'},{imei:usedImei,condition:'NEW'}]}],0,[],key);
    expect(response.statusCode).toBe(409);
    expect((await pool.query('SELECT id FROM devices WHERE imei=$1',[freshImei])).rowCount).toBe(0);
    expect((await pool.query('SELECT count(*) FROM purchases')).rows[0].count).toBe(before);
    expect((await pool.query('SELECT key FROM idempotency WHERE key=$1',[key])).rowCount).toBe(0);
  });
  it('validates IMEIs globally, product kinds, quantities, suppliers and request bounds',async () => {
    const phone=await product('PHONE'); const accessory=await product(); const duplicate=imei();
    const invalid=[
      [{product_id:phone.id,quantity:1,unit_cost:1,devices:[{imei:duplicate,condition:'NEW'}]},{product_id:phone.id,quantity:1,unit_cost:2,devices:[{imei:duplicate,condition:'USED'}]}],
      [{product_id:phone.id,quantity:2,unit_cost:1,devices:[{imei:imei(),condition:'NEW'}]}],
      [{product_id:phone.id,quantity:1,unit_cost:1,devices:[{imei:'123',condition:'NEW'}]}],
      [{product_id:accessory.id,quantity:1,unit_cost:1,devices:[]}],
      [{product_id:accessory.id,quantity:0,unit_cost:1}],
      [{product_id:accessory.id,quantity:1.5,unit_cost:1}],
      [{product_id:accessory.id,quantity:1,unit_cost:-1}],
    ];
    for (const lines of invalid) expect((await purchase(lines)).statusCode).toBe(400);
    expect((await purchase([{product_id:randomUUID(),quantity:1,unit_cost:1}])).statusCode).toBe(404);
    expect((await post('/api/purchases',{supplier_id:randomUUID(),extra_cost:0,payments:[],lines:[{product_id:accessory.id,quantity:1,unit_cost:1}]})).statusCode).toBe(404);
    expect((await purchase(Array.from({length:201},() => ({product_id:accessory.id,quantity:1,unit_cost:0})))).statusCode).toBe(400);
  });
  it('rejects overpayment and MAX_SAFE multiplication/addition overflow before recording stock',async () => {
    const accessory=await product();
    for (const [quantity,unit_cost,extra] of [[2,Number.MAX_SAFE_INTEGER,0],[1,Number.MAX_SAFE_INTEGER,1]]) {
      const response=await purchase([{product_id:accessory.id,quantity,unit_cost}],extra);
      expect(response.statusCode).toBe(422); expect(response.json().error.code).toBe('MONEY_RANGE');
    }
    expect((await purchase([{product_id:accessory.id,quantity:1,unit_cost:5}],0,[{method:'cash',amount:6}])).statusCode).toBe(422);
    expect((await pool.query('SELECT id FROM accessory_lots WHERE product_id=$1',[accessory.id])).rowCount).toBe(0);
    const max=await purchase([{product_id:accessory.id,quantity:1,unit_cost:Number.MAX_SAFE_INTEGER}]);
    expect(max.statusCode,max.body).toBe(201); expect(max.json().total).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('serializes same-key concurrent purchases and rejects changed payload without extra stock/payment/audit',async () => {
    const accessory=await product(); const key=randomUUID(); const lines=[{product_id:accessory.id,quantity:3,unit_cost:9}];
    const responses=await Promise.all(Array.from({length:5},() => purchase(lines,1,[{method:'cash',amount:10}],key)));
    for (const response of responses) { expect(response.statusCode,response.body).toBe(201); expect(response.json()).toEqual(responses[0].json()); }
    expect((await purchase(lines,2,[{method:'cash',amount:10}],key)).statusCode).toBe(409);
    expect((await pool.query('SELECT count(*) FROM audit_logs WHERE entity_id=$1',[responses[0].json().id])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT sum(remaining_quantity)::bigint AS quantity FROM accessory_lots WHERE product_id=$1',[accessory.id])).rows[0].quantity).toBe(3);
  });
  it('rolls back stock, payments, cash, audit and key when cash writing fails, then retries cleanly',async () => {
    const accessory=await product(); const key=randomUUID();
    await pool.query(`CREATE FUNCTION fail_cash_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced cash failure'; END $$`);
    await pool.query('CREATE TRIGGER test_fail_cash BEFORE INSERT ON cash_entries FOR EACH ROW EXECUTE FUNCTION fail_cash_test()');
    const before=(await pool.query('SELECT count(*) FROM purchases')).rows[0].count;
    try {
      expect((await purchase([{product_id:accessory.id,quantity:2,unit_cost:5}],0,[{method:'cash',amount:5}],key)).statusCode).toBe(500);
      expect((await pool.query('SELECT id FROM accessory_lots WHERE product_id=$1',[accessory.id])).rowCount).toBe(0);
      expect((await pool.query('SELECT id FROM stock_movements WHERE product_id=$1',[accessory.id])).rowCount).toBe(0);
      expect((await pool.query('SELECT key FROM idempotency WHERE key=$1',[key])).rowCount).toBe(0);
      expect((await pool.query('SELECT count(*) FROM purchases')).rows[0].count).toBe(before);
    } finally { await pool.query('DROP TRIGGER test_fail_cash ON cash_entries'); }
    expect((await purchase([{product_id:accessory.id,quantity:2,unit_cost:5}],0,[{method:'cash',amount:5}],key)).statusCode).toBe(201);
  });
  it('protects stock sources and append-only ledgers independently in PostgreSQL',async () => {
    const lot=(await pool.query('SELECT * FROM accessory_lots LIMIT 1')).rows[0];
    await expect(pool.query('UPDATE accessory_lots SET remaining_quantity=-1 WHERE id=$1',[lot.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('UPDATE accessory_lots SET unit_cost=0 WHERE id=$1',[lot.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('DELETE FROM stock_movements WHERE lot_id=$1',[lot.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('UPDATE purchases SET total=0')).rejects.toMatchObject({code:'23514'});
    const paid=(await pool.query('SELECT * FROM payments LIMIT 1')).rows[0];
    await expect(pool.query('DELETE FROM payments WHERE id=$1',[paid.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('INSERT INTO payments(purchase_id,method,amount,actor) SELECT id,\'cash\',total+1,$1 FROM purchases WHERE id=$2',[actor,paid.purchase_id])).rejects.toMatchObject({code:'23514'});
  });
});

describe('sales and FIFO',() => {
  it('consumes FIFO across original lots, derives combined payments/debt and keeps immutable snapshots',async () => {
    const item=await product();
    const bought=await purchase([{product_id:item.id,quantity:2,unit_cost:10},{product_id:item.id,quantity:3,unit_cost:20}]);
    expect(bought.statusCode,bought.body).toBe(201);
    const response=await sale([{product_id:item.id,quantity:4,unit_price:40}],[{method:'cash',amount:40},{method:'bank',amount:60}]);
    expect(response.statusCode,response.body).toBe(201);
    const doc=response.json();
    expect(doc).toMatchObject({total:160,paid:100,debt:60,cost:60,status:'posted',customer_name:'Transaction customer'});
    expect(doc.lines[0]).toMatchObject({product_name:item.name,sku:item.sku,quantity:4,unit_price:40,discount:0,total:160,cost:60,returned_quantity:0});
    expect(doc.lines[0].allocations.map((a:any) => [a.quantity,a.unit_cost,a.cost])).toEqual([[2,10,20],[2,20,40]]);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(1);
    expect((await pool.query('SELECT sum(quantity)::bigint AS quantity,sum(cost)::bigint AS cost FROM stock_movements WHERE sale_line_id=$1',[doc.lines[0].id])).rows[0]).toEqual({quantity:-4,cost:-60});
    const history=(await get(`/api/customers/${customer}`)).json();
    expect(history.debt).toBe(60); expect(history.sales[0].id).toBe(doc.id); expect(history.payments).toHaveLength(2);
    expect((await get(`/api/sales?q=${item.sku}`)).json().items[0].id).toBe(doc.id);
    await app.inject({method:'PATCH',url:`/api/products/${item.id}`,headers:headers(),payload:{name:'New catalog name',sale_price:9999}});
    await app.inject({method:'PATCH',url:`/api/customers/${customer}`,headers:headers(),payload:{name:'Renamed customer'}});
    const read=(await get(`/api/sales/${doc.id}`)).json();
    expect(read.customer_name).toBe('Transaction customer'); expect(read.lines[0].product_name).toBe(item.name); expect(read.lines[0].unit_price).toBe(40);
    expect((await get(`/api/purchases/${bought.json().id}`)).json().lines[0].product_name).toBe(item.name);
    const movements=(await get('/api/stock-movements')).json().items.filter((row:any) => row.reference_id===doc.id);
    expect(movements).toHaveLength(2); expect(movements[0].reference_type).toBe('sale');
  });
  it('rejects duplicate accessory lines with a useful error and repeated device IDs, but accepts distinct devices of the same model',async () => {
    const accessory=await receiveAccessory(3);
    const duplicate=await sale([{product_id:accessory.id,quantity:1,unit_price:2},{product_id:accessory.id,quantity:1,unit_price:2}]);
    expect(duplicate.statusCode).toBe(400); expect(duplicate.json().error.message).toContain('gộp số lượng');
    const phone=await product('PHONE');
    const bought=(await purchase([
      {product_id:phone.id,quantity:1,unit_cost:25,devices:[{imei:imei(),condition:'USED'}]},
      {product_id:phone.id,quantity:1,unit_cost:35,devices:[{imei:imei(),condition:'USED'}]},
    ])).json();
    const [first,second]=bought.lines.map((line:any) => line.devices[0]);
    expect((await sale([{product_id:phone.id,device_id:first.id,quantity:1,unit_price:50},{product_id:phone.id,device_id:first.id,quantity:1,unit_price:60}],[{method:'cash',amount:110}])).statusCode).toBe(400);
    const response=await sale([{product_id:phone.id,device_id:first.id,quantity:1,unit_price:50},{product_id:phone.id,device_id:second.id,quantity:1,unit_price:60}],[{method:'cash',amount:110}],0,null);
    expect(response.statusCode,response.body).toBe(201); expect(response.json().cost).toBe(60); expect(response.json().customer_id).toBeNull();
    expect((await sale([{product_id:phone.id,device_id:first.id,quantity:1,unit_price:50}])).statusCode).toBe(409);
  });
  it('rejects oversells, wrong-device product, missing device, invalid kinds and blocked device states',async () => {
    const accessory=await receiveAccessory(); const phone=await receivePhone(); const other=await product('PHONE');
    expect((await sale([{product_id:accessory.id,quantity:2,unit_price:10}])).statusCode).toBe(409);
    expect((await sale([{product_id:other.id,device_id:phone.device.id,quantity:1,unit_price:10}])).statusCode).toBe(400);
    expect((await sale([{product_id:phone.id,device_id:randomUUID(),quantity:1,unit_price:10}])).statusCode).toBe(404);
    expect((await sale([{product_id:phone.id,quantity:1,unit_price:10}])).statusCode).toBe(400);
    expect((await sale([{product_id:phone.id,device_id:phone.device.id,quantity:2,unit_price:10}])).statusCode).toBe(400);
    expect((await sale([{product_id:accessory.id,device_id:phone.device.id,quantity:1,unit_price:10}])).statusCode).toBe(400);
    for (const status of ['quarantine','returned_supplier']) {
      await pool.query('UPDATE devices SET status=$2 WHERE id=$1',[phone.device.id,status]);
      expect((await sale([{product_id:phone.id,device_id:phone.device.id,quantity:1,unit_price:10}])).statusCode).toBe(409);
    }
    expect((await get(`/api/products?q=${accessory.sku}`)).json().items[0].stock_quantity).toBe(1);
  });
  it('allows only one concurrent sale of the last accessory',async () => {
    const item=await receiveAccessory(); const line={product_id:item.id,quantity:1,unit_price:20};
    const responses=await Promise.all([sale([line],[{method:'cash',amount:20}]),sale([line],[{method:'bank',amount:20}])]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201,409]);
    expect((await pool.query('SELECT count(*) FROM sale_lines WHERE product_id=$1',[item.id])).rows[0].count).toBe(1);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(0);
  });
  it('allows only one concurrent sale of the same IMEI',async () => {
    const phone=await receivePhone(); const line={product_id:phone.id,device_id:phone.device.id,quantity:1,unit_price:100};
    const responses=await Promise.all([sale([line],[{method:'cash',amount:100}]),sale([line],[{method:'bank',amount:100}])]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201,409]);
    expect((await pool.query('SELECT count(*) FROM sale_lines WHERE device_id=$1',[phone.device.id])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[phone.device.id])).rows[0].status).toBe('sold');
  });
  it('replays concurrent same-key sales once and rejects payload conflicts without consuming again',async () => {
    const item=await receiveAccessory(3); const key=randomUUID(); const lines=[{product_id:item.id,quantity:1,unit_price:20}];
    const responses=await Promise.all(Array.from({length:5},() => sale(lines,[{method:'cash',amount:20}],0,null,key)));
    for (const response of responses) { expect(response.statusCode,response.body).toBe(201); expect(response.json()).toEqual(responses[0].json()); }
    expect((await sale(lines,[{method:'cash',amount:19}],0,customer,key)).statusCode).toBe(409);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(2);
    expect((await pool.query('SELECT count(*) FROM cash_entries c JOIN payments p ON p.id=c.payment_id WHERE p.sale_id=$1',[responses[0].json().id])).rows[0].count).toBe(1);
  });
  it('requires customers for debt, rejects overpayment/discount/invalid money, and conserves a whole-dong discount',async () => {
    const first=await receiveAccessory(3,0); const second=await receiveAccessory(1,0);
    const lines=[{product_id:first.id,quantity:3,unit_price:1},{product_id:second.id,quantity:1,unit_price:2}];
    expect((await sale(lines,[],0,null)).statusCode).toBe(422);
    expect((await sale(lines,[{method:'cash',amount:6}])).statusCode).toBe(422);
    expect((await sale(lines,[],6)).statusCode).toBe(422);
    expect((await sale([{product_id:first.id,quantity:1,unit_price:-1}])).statusCode).toBe(400);
    expect((await sale([{product_id:first.id,quantity:1,unit_price:0.1}])).statusCode).toBe(400);
    expect((await sale(lines,[{method:'cash',amount:0}])).statusCode).toBe(400);
    const response=await sale(lines,[{method:'cash',amount:3}],2,null);
    expect(response.statusCode,response.body).toBe(201); expect(response.json()).toMatchObject({subtotal:5,discount:2,total:3,paid:3,debt:0});
    expect(response.json().lines.map((line:any) => line.discount)).toEqual([2,0]);
    expect(response.json().lines.map((line:any) => line.total)).toEqual([1,2]);
  });
  it('allows zero-value sales without dividing by zero and checks gross/cost/paid overflow before stock mutation',async () => {
    const zero=await receiveAccessory(1,0);
    const free=await sale([{product_id:zero.id,quantity:1,unit_price:0}],[],0,null);
    expect(free.statusCode,free.body).toBe(201); expect(free.json().total).toBe(0);
    const item=await receiveAccessory(2,1); const other=await receiveAccessory(1,1);
    for (const lines of [
      [{product_id:item.id,quantity:2,unit_price:Number.MAX_SAFE_INTEGER}],
      [{product_id:item.id,quantity:1,unit_price:Number.MAX_SAFE_INTEGER},{product_id:other.id,quantity:1,unit_price:1}],
    ]) expect((await sale(lines)).statusCode).toBe(422);
    expect((await sale([{product_id:item.id,quantity:1,unit_price:1}],[{method:'cash',amount:Number.MAX_SAFE_INTEGER},{method:'bank',amount:1}])).statusCode).toBe(422);
    const expensive=await product();
    expect((await purchase([{product_id:expensive.id,quantity:1,unit_cost:Number.MAX_SAFE_INTEGER},{product_id:expensive.id,quantity:1,unit_cost:1}])).statusCode).toBe(422);
    expect((await purchase([{product_id:expensive.id,quantity:1,unit_cost:Number.MAX_SAFE_INTEGER}])).statusCode).toBe(201);
    expect((await purchase([{product_id:expensive.id,quantity:1,unit_cost:1}])).statusCode).toBe(201);
    const overflow=await sale([{product_id:expensive.id,quantity:2,unit_price:1}]);
    expect(overflow.statusCode).toBe(422); expect(overflow.json().error.code).toBe('MONEY_RANGE');
    expect((await get(`/api/products?q=${expensive.sku}`)).json().items[0].stock_quantity).toBe(2);
    const safe=await sale([{product_id:expensive.id,quantity:1,unit_price:Number.MAX_SAFE_INTEGER}],[{method:'cash',amount:Number.MAX_SAFE_INTEGER}],0,null);
    expect(safe.statusCode,safe.body).toBe(201); expect(safe.json()).toMatchObject({total:Number.MAX_SAFE_INTEGER,cost:Number.MAX_SAFE_INTEGER,paid:Number.MAX_SAFE_INTEGER});
  });
  it.each(['cash_entries','audit_logs'])('rolls back device/lot stock, sales, allocations, payments, cash, audit and key after a %s failure',async table => {
    const item=await receiveAccessory(2); const phone=await receivePhone(); const key=randomUUID();
    const lines=[{product_id:item.id,quantity:1,unit_price:20},{product_id:phone.id,device_id:phone.device.id,quantity:1,unit_price:100}];
    const before=await ledgerCounts();
    await pool.query(`CREATE OR REPLACE FUNCTION fail_sale_write_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced sale write failure'; END $$`);
    await pool.query(`CREATE TRIGGER test_fail_sale_write BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_sale_write_test()`);
    try {
      expect((await sale(lines,[{method:'cash',amount:120}],0,null,key)).statusCode).toBe(500);
      expect(await ledgerCounts()).toEqual(before);
      expect((await pool.query('SELECT status FROM devices WHERE id=$1',[phone.device.id])).rows[0].status).toBe('available');
      expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(2);
    } finally { await pool.query(`DROP TRIGGER test_fail_sale_write ON ${table}`); }
    expect((await sale(lines,[{method:'cash',amount:120}],0,null,key)).statusCode).toBe(201);
  });
  it('keeps document/line/allocation/cash snapshots append-only in PostgreSQL',async () => {
    const line=(await pool.query('SELECT id FROM sale_lines LIMIT 1')).rows[0];
    await expect(pool.query('UPDATE sale_lines SET unit_price=0 WHERE id=$1',[line.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('UPDATE sales SET customer_name=\'changed\'')).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('DELETE FROM sale_allocations')).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('DELETE FROM cash_entries')).rejects.toMatchObject({code:'23514'});
  });
});

describe('debt collections',() => {
  it('serializes concurrent customer collections, replays one payment and derives customer history/debt',async () => {
    const ownCustomer=(await post('/api/customers',{name:'Collection customer'})).json().id;
    const item=await receiveAccessory();
    const sold=await sale([{product_id:item.id,quantity:1,unit_price:100}],[{method:'cash',amount:30}],0,ownCustomer);
    expect(sold.statusCode,sold.body).toBe(201);
    const payload={party_type:'customer',reference_id:sold.json().id,method:'bank',amount:50};
    const responses=await Promise.all([post('/api/payments',payload),post('/api/payments',payload)]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201,422]);
    expect((await get(`/api/sales/${sold.json().id}`)).json()).toMatchObject({paid:80,debt:20});
    const key=randomUUID(); const final={...payload,amount:20,note:'Final debt collection'};
    const paid=await post('/api/payments',final,key); const replay=await post('/api/payments',final,key);
    expect(paid.statusCode,paid.body).toBe(201); expect(replay.json()).toEqual(paid.json());
    expect((await post('/api/payments',{...final,amount:1},key)).statusCode).toBe(409);
    expect((await post('/api/payments',{...payload,amount:1})).statusCode).toBe(422);
    const party=(await get(`/api/customers/${ownCustomer}`)).json();
    expect(party).toMatchObject({debt:0}); expect(party.sales[0]).toMatchObject({paid:100,debt:0}); expect(party.payments).toHaveLength(3);
    expect((await pool.query('SELECT sum(c.amount)::bigint AS amount FROM cash_entries c JOIN payments p ON p.id=c.payment_id WHERE p.sale_id=$1 AND c.direction=\'in\'',[sold.json().id])).rows[0].amount).toBe(100);
    expect((await post('/api/payments',{...final,party_type:'supplier'})).statusCode).toBe(404);
    expect((await post('/api/payments',{...final,amount:0})).statusCode).toBe(400);
    expect((await post('/api/payments',{...final,amount:0.5})).statusCode).toBe(400);
  });
  it('serializes supplier debt payments and records outflows without changing the original purchase',async () => {
    const ownSupplier=(await post('/api/suppliers',{name:'Collection supplier'})).json().id;
    const item=await product();
    const bought=await post('/api/purchases',{supplier_id:ownSupplier,extra_cost:0,lines:[{product_id:item.id,quantity:1,unit_cost:100}],payments:[]});
    expect(bought.statusCode,bought.body).toBe(201);
    const payload={party_type:'supplier',reference_id:bought.json().id,method:'cash',amount:70};
    const responses=await Promise.all([post('/api/payments',payload),post('/api/payments',payload)]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201,422]);
    expect((await post('/api/payments',{...payload,method:'bank',amount:30})).statusCode).toBe(201);
    const detail=(await get(`/api/purchases/${bought.json().id}`)).json();
    expect(detail).toMatchObject({total:100,paid:100,debt:0});
    const party=(await get(`/api/suppliers/${ownSupplier}`)).json();
    expect(party.debt).toBe(0); expect(party.payments).toHaveLength(2);
    expect((await pool.query('SELECT sum(c.amount)::bigint AS amount FROM cash_entries c JOIN payments p ON p.id=c.payment_id WHERE p.purchase_id=$1 AND c.direction=\'out\'',[bought.json().id])).rows[0].amount).toBe(100);
  });
  it('replays parallel same-key collections only once and rejects unknown documents/missing idempotency',async () => {
    const item=await receiveAccessory();
    const sold=(await sale([{product_id:item.id,quantity:1,unit_price:100}])).json();
    const payload={party_type:'customer',reference_id:sold.id,method:'cash',amount:40}; const key=randomUUID();
    const responses=await Promise.all(Array.from({length:4},() => post('/api/payments',payload,key)));
    for (const response of responses) { expect(response.statusCode,response.body).toBe(201); expect(response.json()).toEqual(responses[0].json()); }
    expect((await get(`/api/sales/${sold.id}`)).json()).toMatchObject({paid:40,debt:60});
    expect((await post('/api/payments',{...payload,reference_id:randomUUID()})).statusCode).toBe(404);
    expect((await app.inject({method:'POST',url:'/api/payments',headers:{cookie,origin},payload})).statusCode).toBe(400);
  });
});

const returnSale=(document:any,quantity:number,method:'cash'|'bank'='cash',key?:string,disposition:'available'|'quarantine'='available') =>
  post('/api/returns',{sale_id:document.id,reason:'Customer return',disposition,method,lines:[{sale_line_id:document.lines[0].id,quantity}]},key);
const returnPurchase=(purchase_id:string,lines:unknown[],method:'cash'|'bank'='cash',key?:string) =>
  post('/api/purchase-returns',{purchase_id,reason:'Supplier return',method,lines},key);
const createWarranty=(device_id:string,customer_id?:string,issue='Device issue',key?:string) =>
  post('/api/warranties',{device_id,...(customer_id?{customer_id}:{}),issue},key);

describe('sale returns and cancellation',() => {
  it('conserves discounted dong and original cost for 1+1+1 returns versus one full return',async () => {
    const item=await receiveAccessory(6,11);
    const first=(await sale([{product_id:item.id,quantity:3,unit_price:2}],[{method:'cash',amount:5}],1,null)).json();
    const second=(await sale([{product_id:item.id,quantity:3,unit_price:2}],[{method:'bank',amount:5}],1,null)).json();
    const parts=[];
    for (let index=0;index<3;index++) {
      const response=await returnSale(first,1);
      expect(response.statusCode,response.body).toBe(201); parts.push(response.json());
    }
    const full=await returnSale(second,3,'bank');
    expect(full.statusCode,full.body).toBe(201);
    expect(parts.map(part => part.total)).toEqual([1,2,2]);
    expect(parts.reduce((sum,part) => sum+part.refund,0)).toBe(full.json().refund);
    expect(parts.reduce((sum,part) => sum+part.cost,0)).toBe(full.json().cost);
    expect(full.json()).toMatchObject({total:5,cost:33,refund:5,debt_reduction:0});
    const detail=(await get(`/api/sales/${first.id}`)).json();
    expect(detail).toMatchObject({total:5,paid:5,returned_total:5,net_total:0,refunded:5,paid_net:0,debt:0,status:'returned'});
    expect(detail.lines[0]).toMatchObject({returned_quantity:3,total:5,cost:33});
    expect(detail.returns).toHaveLength(3);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(6);
    expect((await returnSale(first,1)).statusCode).toBe(422);
  });
  it('restores original FIFO allocations in order across partial returns, preserving purchase provenance for resale',async () => {
    const item=await product();
    const bought=(await purchase([{product_id:item.id,quantity:2,unit_cost:10},{product_id:item.id,quantity:2,unit_cost:21}])).json();
    const sold=(await sale([{product_id:item.id,quantity:4,unit_price:30}],[{method:'cash',amount:120}],0,null)).json();
    const first=await returnSale(sold,3);
    expect(first.statusCode,first.body).toBe(201); expect(first.json()).toMatchObject({cost:41,total:90});
    const second=await returnSale(sold,1);
    expect(second.statusCode,second.body).toBe(201); expect(second.json().cost).toBe(21);
    const lots=(await pool.query('SELECT * FROM accessory_lots WHERE product_id=$1 ORDER BY created_at,id',[item.id])).rows;
    expect(lots.map(lot => [lot.id,lot.purchase_line_id,lot.remaining_quantity])).toEqual(bought.lines.map((line:any) => [line.lots[0].id,line.id,2]));
    const resold=(await sale([{product_id:item.id,quantity:3,unit_price:30}],[{method:'bank',amount:90}],0,null)).json();
    expect(resold.cost).toBe(41);
    expect(resold.lines[0].allocations.map((allocation:any) => allocation.lot_id)).toEqual(lots.map(lot => lot.id));
    const movements=(await get('/api/stock-movements')).json().items.filter((row:any) => row.reference_id===first.json().id);
    expect(movements).toHaveLength(2);
    expect(movements.every((row:any) => row.reference_type==='return' && row.quantity>0 && row.cost>0 && row.sale_line_id===sold.lines[0].id)).toBe(true);
  });
  it('keeps phone sold-return-resold-return history and quarantines only the returned phone',async () => {
    const phone=await receivePhone(); const accessory=await receiveAccessory();
    const line={product_id:phone.id,device_id:phone.device.id,quantity:1,unit_price:100};
    const first=(await sale([line,{product_id:accessory.id,quantity:1,unit_price:10}],[{method:'cash',amount:110}],0,null)).json();
    expect((await returnSale(first,1)).statusCode).toBe(201);
    expect((await get(`/api/sales/${first.id}`)).json().status).toBe('partially_returned');
    const secondResponse=await sale([line],[{method:'bank',amount:100}],0,null);
    expect(secondResponse.statusCode,secondResponse.body).toBe(201);
    const second=secondResponse.json();
    expect((await returnSale(first,1)).statusCode).toBe(422);
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[phone.device.id])).rows[0].status).toBe('sold');
    expect((await returnSale(second,1,'bank',undefined,'quarantine')).statusCode).toBe(201);
    const device=(await pool.query('SELECT * FROM devices WHERE id=$1',[phone.device.id])).rows[0];
    expect(device).toMatchObject({status:'quarantine',cost:30,purchase_line_id:phone.device.purchase_line_id});
    expect((await pool.query('SELECT count(*) FROM sale_lines WHERE device_id=$1',[phone.device.id])).rows[0].count).toBe(2);
    expect((await pool.query('SELECT count(*) FROM stock_movements WHERE device_id=$1',[phone.device.id])).rows[0].count).toBe(5);
    expect((await get(`/api/products?q=${phone.sku}`)).json().items[0].stock_quantity).toBe(0);
    expect((await sale([line],[{method:'cash',amount:100}],0,null)).statusCode).toBe(409);
  });
  it.each(['PHONE','ACCESSORY'] as const)('allows only one different-key concurrent return of the last %s quantity',async kind => {
    const item=kind==='PHONE'?await receivePhone():await receiveAccessory();
    const line={product_id:item.id,quantity:1,unit_price:20,...('device' in item?{device_id:item.device.id}:{})};
    const sold=(await sale([line],[{method:'cash',amount:20}],0,null)).json();
    const responses=await Promise.all([returnSale(sold,1),returnSale(sold,1,'bank')]);
    expect(responses.map(response => response.statusCode).sort()).toEqual([201,422]);
    expect((await pool.query('SELECT count(*) FROM returns WHERE sale_id=$1',[sold.id])).rows[0].count).toBe(1);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(1);
    expect((await get(`/api/sales/${sold.id}`)).json()).toMatchObject({debt:0,paid_net:0,refunded:20});
  });
  it('reduces debt before refunding mixed-method receipts and exposes net customer history without fake payments',async () => {
    const ownCustomer=(await post('/api/customers',{name:'Return customer'})).json().id;
    const item=await receiveAccessory(2);
    const sold=(await sale([{product_id:item.id,quantity:2,unit_price:50}],[{method:'cash',amount:30},{method:'bank',amount:20}],0,ownCustomer)).json();
    const first=await returnSale(sold,1,'bank');
    expect(first.statusCode,first.body).toBe(201); expect(first.json()).toMatchObject({total:50,debt_reduction:50,refund:0});
    expect((await pool.query('SELECT id FROM cash_entries WHERE return_id=$1',[first.json().id])).rowCount).toBe(0);
    expect((await get(`/api/sales/${sold.id}`)).json()).toMatchObject({total:100,net_total:50,paid:50,paid_net:50,debt:0,status:'partially_returned'});
    expect((await post('/api/payments',{party_type:'customer',reference_id:sold.id,method:'cash',amount:1})).statusCode).toBe(422);
    const second=await returnSale(sold,1,'bank');
    expect(second.statusCode,second.body).toBe(201); expect(second.json()).toMatchObject({total:50,debt_reduction:0,refund:50});
    expect((await pool.query('SELECT direction,method,amount,category FROM cash_entries WHERE return_id=$1',[second.json().id])).rows).toEqual([{direction:'out',method:'bank',amount:50,category:'sale_refund'}]);
    const party=(await get(`/api/customers/${ownCustomer}`)).json();
    expect(party.debt).toBe(0); expect(party.payments).toHaveLength(2); expect(party.returns).toHaveLength(2);
    expect(party.sales[0]).toMatchObject({net_total:0,paid_net:0,refunded:50,status:'returned'});
    await expect(pool.query("INSERT INTO payments(sale_id,method,amount,actor) VALUES ($1,'cash',1,$2)",[sold.id,actor])).rejects.toMatchObject({code:'23514'});
  });
  it('serializes a return against collection and never overpays or produces negative debt',async () => {
    const item=await receiveAccessory(2);
    const sold=(await sale([{product_id:item.id,quantity:2,unit_price:50}],[{method:'cash',amount:30}])).json();
    const [returned,collected]=await Promise.all([returnSale(sold,1,'bank'),post('/api/payments',{party_type:'customer',reference_id:sold.id,method:'bank',amount:50})]);
    expect(returned.statusCode,returned.body).toBe(201); expect([201,422]).toContain(collected.statusCode);
    const detail=(await get(`/api/sales/${sold.id}`)).json();
    expect(detail.net_total).toBe(50); expect(detail.paid_net+detail.debt).toBe(50);
    expect(detail.debt).toBe(collected.statusCode===201?0:20);
    expect(detail.refunded).toBe(collected.statusCode===201?30:0);
    const cash=(await pool.query(`SELECT sum(CASE WHEN c.direction='in' THEN c.amount ELSE -c.amount END)::bigint AS net
      FROM cash_entries c LEFT JOIN payments p ON p.id=c.payment_id LEFT JOIN returns r ON r.id=c.return_id WHERE p.sale_id=$1 OR r.sale_id=$1`,[sold.id])).rows[0].net;
    expect(cash).toBe(detail.paid_net);
    if (detail.debt) expect((await post('/api/payments',{party_type:'customer',reference_id:sold.id,method:'cash',amount:detail.debt})).statusCode).toBe(201);
    expect((await post('/api/payments',{party_type:'customer',reference_id:sold.id,method:'cash',amount:1})).statusCode).toBe(422);
  });
  it.each(['cash_entries','audit_logs'])('rolls back every return/device/lot/cash/key write after forced %s failure and retries cleanly',async table => {
    const item=await receiveAccessory(); const phone=await receivePhone(); const key=randomUUID();
    const sold=(await sale([{product_id:item.id,quantity:1,unit_price:20},{product_id:phone.id,device_id:phone.device.id,quantity:1,unit_price:100}],[{method:'cash',amount:120}],0,null)).json();
    const payload={sale_id:sold.id,reason:'Rollback return',disposition:'available',method:'cash',lines:sold.lines.map((line:any) => ({sale_line_id:line.id,quantity:1}))};
    const before=await ledgerCounts();
    await pool.query(`CREATE OR REPLACE FUNCTION fail_return_write_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced return failure'; END $$`);
    await pool.query(`CREATE TRIGGER fail_return_write BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_return_write_test()`);
    try {
      expect((await post('/api/returns',payload,key)).statusCode).toBe(500);
      expect(await ledgerCounts()).toEqual(before);
      expect((await pool.query('SELECT status FROM devices WHERE id=$1',[phone.device.id])).rows[0].status).toBe('sold');
      expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(0);
      expect((await get(`/api/sales/${sold.id}`)).json()).toMatchObject({returned_total:0,refunded:0,status:'posted'});
    } finally { await pool.query(`DROP TRIGGER fail_return_write ON ${table}`); }
    expect((await post('/api/returns',payload,key)).statusCode).toBe(201);
  });
  it('replays parallel same-key returns exactly once and rejects changed payload',async () => {
    const item=await receiveAccessory(2);
    const sold=(await sale([{product_id:item.id,quantity:2,unit_price:10}],[{method:'cash',amount:20}],0,null)).json(); const key=randomUUID();
    const responses=await Promise.all(Array.from({length:4},() => returnSale(sold,1,'cash',key)));
    for (const response of responses) { expect(response.statusCode,response.body).toBe(201); expect(response.json()).toEqual(responses[0].json()); }
    expect((await returnSale(sold,1,'bank',key)).statusCode).toBe(409);
    expect((await get(`/api/sales/${sold.id}`)).json().lines[0].returned_quantity).toBe(1);
    expect((await pool.query('SELECT count(*) FROM cash_entries c JOIN returns r ON r.id=c.return_id WHERE r.sale_id=$1',[sold.id])).rows[0].count).toBe(1);
  });
  it('cancels only the remainder after partial returns, replays cancellation and rejects another reversal',async () => {
    const item=await receiveAccessory(3);
    const sold=(await sale([{product_id:item.id,quantity:3,unit_price:20}],[{method:'cash',amount:60}],0,null)).json();
    expect((await returnSale(sold,1)).statusCode).toBe(201);
    const payload={reason:'Cancel remaining',disposition:'available',method:'bank'}; const key=randomUUID();
    const cancelled=await post(`/api/sales/${sold.id}/cancel`,payload,key);
    expect(cancelled.statusCode,cancelled.body).toBe(201);
    expect(cancelled.json()).toMatchObject({kind:'cancel',total:40,cost:20,refund:40,debt_reduction:0});
    expect(cancelled.json().lines[0].quantity).toBe(2);
    expect((await post(`/api/sales/${sold.id}/cancel`,payload,key)).json()).toEqual(cancelled.json());
    expect((await post(`/api/sales/${sold.id}/cancel`,payload)).statusCode).toBe(422);
    expect((await returnSale(sold,1)).statusCode).toBe(422);
    expect((await get(`/api/sales/${sold.id}`)).json()).toMatchObject({total:60,returned_total:60,net_total:0,paid_net:0,debt:0,status:'cancelled'});
    expect((await pool.query('SELECT total,status FROM sales WHERE id=$1',[sold.id])).rows[0]).toEqual({total:60,status:'posted'});
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(3);
  });
  it('validates line ownership, duplicate IDs, quantities, reason, disposition and idempotency before writes',async () => {
    const item=await receiveAccessory(2);
    const sold=(await sale([{product_id:item.id,quantity:1,unit_price:20}])).json();
    const payload={sale_id:sold.id,reason:'Return',disposition:'available',method:'cash',lines:[{sale_line_id:sold.lines[0].id,quantity:1}]};
    const before=await ledgerCounts();
    for (const change of [{reason:''},{disposition:'sold'},{method:'other'},{lines:[]},{lines:[{sale_line_id:sold.lines[0].id,quantity:0}]},{lines:[...payload.lines,...payload.lines]}])
      expect((await post('/api/returns',{...payload,...change})).statusCode).toBe(400);
    expect((await post('/api/returns',{...payload,lines:[{sale_line_id:randomUUID(),quantity:1}]})).statusCode).toBe(422);
    expect((await returnSale(sold,2)).statusCode).toBe(422);
    expect((await post('/api/returns',{...payload,sale_id:randomUUID()})).statusCode).toBe(404);
    expect((await app.inject({method:'POST',url:'/api/returns',headers:{cookie,origin},payload})).statusCode).toBe(400);
    expect(await ledgerCounts()).toEqual(before);
  });
  it('returns zero-price stock by quantity and preserves MAX_SAFE refund exactly',async () => {
    const free=await receiveAccessory(2,0);
    const sold=(await sale([{product_id:free.id,quantity:2,unit_price:0}],[],0,null)).json();
    expect((await returnSale(sold,1)).statusCode).toBe(201);
    expect((await get(`/api/sales/${sold.id}`)).json().status).toBe('partially_returned');
    expect((await returnSale(sold,1)).statusCode).toBe(201);
    expect((await get(`/api/sales/${sold.id}`)).json().status).toBe('returned');
    const item=await receiveAccessory(1,0);
    const expensive=(await sale([{product_id:item.id,quantity:1,unit_price:Number.MAX_SAFE_INTEGER}],[{method:'bank',amount:Number.MAX_SAFE_INTEGER}],0,null)).json();
    const returned=await returnSale(expensive,1,'bank');
    expect(returned.statusCode,returned.body).toBe(201); expect(returned.json().refund).toBe(Number.MAX_SAFE_INTEGER);
    expect((await get(`/api/sales/${expensive.id}`)).json()).toMatchObject({debt:0,paid_net:0,refunded:Number.MAX_SAFE_INTEGER});
  });
  it('protects return history and original allocation limits directly in PostgreSQL',async () => {
    const line=(await pool.query('SELECT * FROM return_lines LIMIT 1')).rows[0];
    await expect(pool.query('DELETE FROM returns WHERE id=$1',[line.return_id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('UPDATE return_lines SET quantity=1 WHERE id=$1',[line.id])).rejects.toMatchObject({code:'23514'});
    await expect(pool.query('DELETE FROM return_allocations')).rejects.toMatchObject({code:'23514'});
    await expect(pool.query(`INSERT INTO return_lines(return_id,sale_id,sale_line_id,product_id,position,quantity,value,cost)
      SELECT return_id,sale_id,sale_line_id,product_id,999,2147483647,0,0 FROM return_lines WHERE id=$1`,[line.id])).rejects.toMatchObject({code:'23514'});
    const allocation=(await pool.query('SELECT * FROM return_allocations LIMIT 1')).rows[0];
    await expect(pool.query(`INSERT INTO return_allocations(return_line_id,sale_line_id,sale_allocation_id,quantity,cost)
      VALUES ($1,$2,$3,2147483647,0)`,[allocation.return_line_id,allocation.sale_line_id,allocation.sale_allocation_id])).rejects.toMatchObject({code:'23514'});
  });
});

describe('supplier returns and warranties',()=>{
  it('returns only available original devices and preserves returned-supplier device history',async()=>{
    const phone=await product('PHONE'); const firstImei=imei(),secondImei=imei();
    const bought=(await purchase([{product_id:phone.id,quantity:2,unit_cost:25,devices:[{imei:firstImei,condition:'NEW'},{imei:secondImei,condition:'USED'}]}])).json();
    const devices=bought.lines[0].devices;
    const sold=await sale([{product_id:phone.id,device_id:devices[0].id,quantity:1,unit_price:50}],[{method:'cash',amount:50}],0,null);
    expect(sold.statusCode).toBe(201);
    expect((await returnPurchase(bought.id,[{purchase_line_id:bought.lines[0].id,quantity:1,device_ids:[devices[0].id]}])).statusCode).toBe(422);
    const returned=await returnPurchase(bought.id,[{purchase_line_id:bought.lines[0].id,quantity:1,device_ids:[devices[1].id]}]);
    expect(returned.statusCode,returned.body).toBe(201); expect(returned.json()).toMatchObject({total:25,refund:0,debt_reduction:25});
    expect((await pool.query('SELECT status,cost FROM devices WHERE id=$1',[devices[1].id])).rows[0]).toEqual({status:'returned_supplier',cost:25});
    expect((await returnPurchase(bought.id,[{purchase_line_id:bought.lines[0].id,quantity:1,device_ids:[devices[1].id]}])).statusCode).toBe(422);
    expect((await returnPurchase(bought.id,[{purchase_line_id:bought.lines[0].id,quantity:1,device_ids:[devices[0].id]}])).statusCode).toBe(422);
  });
  it('reduces supplier debt before refunding only paid value and reports immutable original totals',async()=>{
    const ownSupplier=(await post('/api/suppliers',{name:'Purchase return customer'})).json().id;
    const item=await product();
    const bought=await post('/api/purchases',{supplier_id:ownSupplier,extra_cost:0,lines:[{product_id:item.id,quantity:2,unit_cost:10}],payments:[{method:'cash',amount:5}]});
    expect(bought.statusCode).toBe(201);
    const first=await returnPurchase(bought.json().id,[{purchase_line_id:bought.json().lines[0].id,quantity:1}]);
    expect(first.statusCode,first.body).toBe(201); expect(first.json()).toMatchObject({total:10,debt_reduction:10,refund:0});
    expect((await post('/api/payments',{party_type:'supplier',reference_id:bought.json().id,method:'bank',amount:5})).statusCode).toBe(201);
    const second=await returnPurchase(bought.json().id,[{purchase_line_id:bought.json().lines[0].id,quantity:1}],'bank');
    expect(second.statusCode,second.body).toBe(201); expect(second.json()).toMatchObject({total:10,debt_reduction:0,refund:10});
    const detail=(await get(`/api/purchases/${bought.json().id}`)).json();
    expect(detail).toMatchObject({total:20,paid:10,returned_total:20,net_total:0,refunded:10,paid_net:0,debt:0});
    const party=(await get(`/api/suppliers/${ownSupplier}`)).json();
    expect(party.debt).toBe(0); expect(party.returns).toHaveLength(2); expect(party.purchases[0].total).toBe(20);
    expect((await pool.query('SELECT direction,method,amount,category FROM cash_entries WHERE purchase_return_id=$1',[second.json().id])).rows).toEqual([{direction:'in',method:'bank',amount:10,category:'purchase_refund'}]);
    expect((await post('/api/payments',{party_type:'supplier',reference_id:bought.json().id,method:'cash',amount:1})).statusCode).toBe(422);
  });
  it('returns accessory cost from original split lots after sale, return and resale',async()=>{
    const item=await product();
    const bought=(await purchase([{product_id:item.id,quantity:3,unit_cost:10}],2)).json();
    expect(bought.lines[0].lots.map((lot:any)=>[lot.quantity,lot.unit_cost])).toEqual([[2,11],[1,10]]);
    const sold=(await sale([{product_id:item.id,quantity:2,unit_price:30}],[{method:'cash',amount:60}],0,null)).json();
    expect((await returnSale(sold,1)).statusCode).toBe(201);
    const resold=await sale([{product_id:item.id,quantity:1,unit_price:30}],[{method:'bank',amount:30}],0,null);
    expect(resold.statusCode,resold.body).toBe(201); expect(resold.json().cost).toBe(11);
    const returned=await returnPurchase(bought.id,[{purchase_line_id:bought.lines[0].id,quantity:1}]);
    expect(returned.statusCode,returned.body).toBe(201); expect(returned.json().total).toBe(10);
    const detail=(await get(`/api/purchases/${bought.id}`)).json();
    expect(detail).toMatchObject({total:32,returned_total:10,net_total:22});
    expect(detail.returns[0].lines[0].allocations[0]).toMatchObject({lot_id:bought.lines[0].lots[1].id,quantity:1,unit_cost:10,cost:10});
  });
  it('serializes concurrent supplier returns and debt payments with correct net balance',async()=>{
    const item=await receiveAccessory(2); const bought=(await purchase([{product_id:item.id,quantity:2,unit_cost:10}])).json();
    const line=bought.lines[0];
    const [returned,paid]=await Promise.all([returnPurchase(bought.id,[{purchase_line_id:line.id,quantity:1}]),
      post('/api/payments',{party_type:'supplier',reference_id:bought.id,method:'cash',amount:20})]);
    expect(returned.statusCode,returned.body).toBe(201); expect([201,422]).toContain(paid.statusCode);
    const detail=(await get(`/api/purchases/${bought.id}`)).json();
    expect(detail.net_total).toBe(10); expect(detail.paid_net+detail.debt).toBe(10);
    expect(detail.debt).toBe(paid.statusCode===201?0:10);
    expect(detail.refunded).toBe(paid.statusCode===201?10:0);
    expect((await returnPurchase(bought.id,[{purchase_line_id:line.id,quantity:1}])).statusCode).toBe(201);
    const over=(await post('/api/payments',{party_type:'supplier',reference_id:bought.id,method:'cash',amount:1})); expect(over.statusCode).toBe(422);
  });
  it('serializes competing supplier returns of the last original accessory unit',async()=>{
    const item=await receiveAccessory(); const bought=(await purchase([{product_id:item.id,quantity:1,unit_cost:10}])).json();
    const lines=[{purchase_line_id:bought.lines[0].id,quantity:1}];
    const responses=await Promise.all([returnPurchase(bought.id,lines),returnPurchase(bought.id,lines,'bank')]);
    expect(responses.map(response=>response.statusCode).sort()).toEqual([201,422]);
    expect((await get(`/api/purchases/${bought.id}`)).json().returned_total).toBe(10);
    expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(1);
  });
  it('replays same-key supplier returns and rolls every write back after a cash failure',async()=>{
    const item=await receiveAccessory(2); const bought=(await purchase([{product_id:item.id,quantity:2,unit_cost:10}],0,[{method:'cash',amount:20}])).json();
    const key=randomUUID(); const lines=[{purchase_line_id:bought.lines[0].id,quantity:1}];
    const [first,replay]=await Promise.all([returnPurchase(bought.id,lines,'cash',key),returnPurchase(bought.id,lines,'cash',key)]);
    expect(first.statusCode,first.body).toBe(201); expect(replay.json()).toEqual(first.json());
    expect((await returnPurchase(bought.id,lines,'bank',key)).statusCode).toBe(409);
    const other=(await purchase([{product_id:item.id,quantity:1,unit_cost:10}],0,[{method:'cash',amount:10}])).json(); const failureKey=randomUUID();
    const before=await ledgerCounts();
    const stockBefore=(await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity;
    await pool.query(`CREATE OR REPLACE FUNCTION fail_supplier_refund_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced supplier refund failure'; END $$`);
    await pool.query('CREATE TRIGGER fail_supplier_refund BEFORE INSERT ON cash_entries FOR EACH ROW WHEN (NEW.purchase_return_id IS NOT NULL) EXECUTE FUNCTION fail_supplier_refund_test()');
    try {
      expect((await returnPurchase(other.id,[{purchase_line_id:other.lines[0].id,quantity:1}],'cash',failureKey)).statusCode).toBe(500);
      expect(await ledgerCounts()).toEqual(before);
      expect((await get(`/api/products?q=${item.sku}`)).json().items[0].stock_quantity).toBe(stockBefore);
    } finally { await pool.query('DROP TRIGGER fail_supplier_refund ON cash_entries'); }
    expect((await returnPurchase(other.id,[{purchase_line_id:other.lines[0].id,quantity:1}],'cash',failureKey)).statusCode).toBe(201);
  });
  it('quarantines shop warranty stock, requires legal transitions and audits explicit release',async()=>{
    const own=await receivePhone(); const customer=(await post('/api/customers',{name:'Warranty owner'})).json().id;
    const received=await createWarranty(own.device.id,customer); expect(received.statusCode,received.body).toBe(201);
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[own.device.id])).rows[0].status).toBe('quarantine');
    expect((await sale([{product_id:own.id,device_id:own.device.id,quantity:1,unit_price:100}])).statusCode).toBe(409);
    expect((await createWarranty(own.device.id)).statusCode).toBe(409);
    expect((await patch(`/api/warranties/${received.json().id}`,{status:'completed',release_to_stock:true})).statusCode).toBe(422);
    const processing=await patch(`/api/warranties/${received.json().id}`,{status:'processing'}); expect(processing.statusCode).toBe(200);
    const completed=await patch(`/api/warranties/${received.json().id}`,{status:'completed',resolution:'Repaired',release_to_stock:true});
    expect(completed.statusCode,completed.body).toBe(200); expect(completed.json()).toMatchObject({status:'completed',resolution:'Repaired'});
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[own.device.id])).rows[0].status).toBe('available');
    expect((await pool.query("SELECT count(*) FROM audit_logs WHERE entity_type='warranty' AND entity_id=$1",[received.json().id])).rows[0].count).toBe(3);
    expect((await get('/api/warranties?q=Warranty')).json().items[0]).toMatchObject({id:received.json().id,customer_id:customer,customer_name:'Warranty owner'});
  });
  it('keeps sold customer phones sold and rejects wrong owner or stock release',async()=>{
    const own=await receivePhone(); const first=(await post('/api/customers',{name:'Actual owner'})).json().id; const wrong=(await post('/api/customers',{name:'Different owner'})).json().id;
    const sold=(await sale([{product_id:own.id,device_id:own.device.id,quantity:1,unit_price:100}],[],0,first)).json();
    expect((await createWarranty(own.device.id,wrong)).statusCode).toBe(422);
    const warranty=await createWarranty(own.device.id,first); expect(warranty.statusCode).toBe(201);
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[own.device.id])).rows[0].status).toBe('sold');
    await patch(`/api/warranties/${warranty.json().id}`,{status:'processing'});
    expect((await returnSale(sold,1,'cash',undefined,'available')).statusCode).toBe(422);
    expect((await patch(`/api/warranties/${warranty.json().id}`,{status:'completed',release_to_stock:true})).statusCode).toBe(422);
    expect((await pool.query('SELECT status FROM devices WHERE id=$1',[own.device.id])).rows[0].status).toBe('sold');
    expect((await get(`/api/sales/${sold.id}`)).json().status).toBe('posted');
  });
  it('serializes warranty intake against sale with product-before-device locks',async()=>{
    const own=await receivePhone();
    const [warranty,sold]=await Promise.all([createWarranty(own.device.id),sale([{product_id:own.id,device_id:own.device.id,quantity:1,unit_price:100}])]);
    expect(warranty.statusCode,warranty.body).toBe(201);
    const status=(await pool.query('SELECT status FROM devices WHERE id=$1',[own.device.id])).rows[0].status;
    if(sold.statusCode===201) expect(status).toBe('sold'); else { expect(sold.statusCode).toBe(409); expect(status).toBe('quarantine'); }
  });
  it('supports completed/cancelled warranty history while rejecting invalid states, IDs and missing idempotency',async()=>{
    const own=await receivePhone(); const first=await createWarranty(own.device.id,undefined,'Warranty test',randomUUID());
    expect(first.statusCode).toBe(201);
    const conflict=await createWarranty(own.device.id); expect(conflict.statusCode).toBe(409);
    expect((await patch(`/api/warranties/${first.json().id}`,{status:'cancelled'})).statusCode).toBe(422);
    expect((await patch(`/api/warranties/${first.json().id}`,{status:'processing'})).statusCode).toBe(200);
    expect((await patch(`/api/warranties/${first.json().id}`,{status:'cancelled'})).statusCode).toBe(200);
    const second=await createWarranty(own.device.id); expect(second.statusCode).toBe(201);
    expect((await app.inject({method:'POST',url:'/api/warranties',headers:{cookie,origin},payload:{device_id:own.device.id,issue:'Missing key'}})).statusCode).toBe(400);
    expect((await post('/api/warranties',{device_id:randomUUID(),issue:'Missing device'})).statusCode).toBe(404);
  });
});
