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
const origin='http://127.0.0.1:5173';
const headers=(key:string=randomUUID()) => ({cookie,origin,'idempotency-key':key});
const imei=() => (++imeiCounter).toString();
const post=(url:string,payload:unknown,key?:string) => app.inject({method:'POST',url,headers:headers(key),payload:payload as object});
const get=(url:string) => app.inject({url,headers:{cookie}});
async function product(kind:'PHONE'|'ACCESSORY'='ACCESSORY') {
  const response=await post('/api/products',{sku:randomUUID(),name:`Test ${kind}`,kind,sale_price:500});
  expect(response.statusCode,response.body).toBe(201);
  return response.json();
}
async function purchase(lines:unknown[],extra_cost=0,payments:unknown[]=[],key?:string) {
  return post('/api/purchases',{supplier_id:supplier,extra_cost,lines,payments},key);
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
