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
let schemaCreated=false;
const schema=`test_${randomUUID().replaceAll('-','')}`;
const origin='http://127.0.0.1:5174';
const headers=(key:string=randomUUID())=>({cookie,origin,'idempotency-key':key});
const post=(payload:unknown,key?:string)=>app.inject({method:'POST',url:'/api/cash',headers:headers(key),payload:payload as object});
const getReport=(from:string,to=from)=>app.inject({url:`/api/reports?from=${from}&to=${to}`,headers:{cookie}});

beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!decodeURIComponent(new URL(url).pathname.slice(1)).endsWith('_test')) throw new Error('Dedicated _test database required');
  admin=createPool(url);
  if(!(await admin.query('SELECT current_database() AS name')).rows[0].name.endsWith('_test')) throw new Error('Refusing non-test database');
  await admin.query(`CREATE SCHEMA ${schema}`); schemaCreated=true;
  pool=createPool(url,{options:`-c search_path=${schema},public`});
  await migrate(pool); await bootstrapManager(pool,'cash-test','test-password-only-123!');
  app=await buildApp({pool,origin});
  const login=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin},payload:{username:'cash-test',password:'test-password-only-123!'}});
  cookie=login.headers['set-cookie']!.toString().split(';')[0]; actor=login.json().id;
});
afterAll(async()=>{
  await app?.close(); await pool?.end();
  if(admin){if(schemaCreated) await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();}
});

describe('cashbook and reports',()=>{
  it('requires authentication and exposes only safe, audited manual entries',async()=>{
    expect((await app.inject('/api/cash')).statusCode).toBe(401);
    expect((await app.inject('/api/reports?from=2026-01-01&to=2026-01-01')).statusCode).toBe(401);
    expect((await app.inject({method:'POST',url:'/api/cash',headers:{origin},payload:{direction:'in',method:'cash',amount:1,category:'other_income'}})).statusCode).toBe(401);
    expect((await post({direction:'in',method:'cash',amount:0,category:'other_income'})).statusCode).toBe(400);
    expect((await post({direction:'out',method:'cash',amount:1,category:'other_income'})).statusCode).toBe(400);
    const result=await post({direction:'in',method:'cash',amount:Number.MAX_SAFE_INTEGER,category:'other_income',note:'manual'});
    expect(result.statusCode).toBe(201);
    expect(result.json()).toMatchObject({direction:'in',method:'cash',amount:Number.MAX_SAFE_INTEGER,category:'other_income',reference_id:null});
    const rows=(await app.inject({url:'/api/cash',headers:{cookie}})).json();
    expect(rows).toMatchObject({cash_balance:Number.MAX_SAFE_INTEGER,bank_balance:0,items:[{reference_id:null}]});
    expect((await pool.query("SELECT action,entity_type,actor FROM audit_logs WHERE entity_type='cash_entry'")).rows).toMatchObject([{action:'create',entity_type:'cash_entry',actor}]);
  });

  it('replays identical keys, rejects conflicts, serializes concurrent writes, and rolls back failed audits',async()=>{
    const key=randomUUID(), payload={direction:'in',method:'bank',amount:17,category:'other_income'};
    const same=await Promise.all([post(payload,key),post(payload,key)]);
    expect(same.map(row=>row.statusCode)).toEqual([201,201]);
    expect(same[0].json().id).toBe(same[1].json().id);
    expect((await post({...payload,amount:18},key)).statusCode).toBe(409);
    const parallel=await Promise.all([
      post({direction:'out',method:'cash',amount:3,category:'expense'}),
      post({direction:'in',method:'bank',amount:5,category:'other_income'}),
    ]);
    expect(parallel.map(row=>row.statusCode)).toEqual([201,201]);
    await pool.query(`CREATE FUNCTION fail_cash_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced audit failure'; END $$`);
    await pool.query("CREATE TRIGGER fail_cash_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_cash_audit()");
    const rollbackKey=randomUUID();
    try { expect((await post({direction:'in',method:'cash',amount:9,category:'other_income'},rollbackKey)).statusCode).toBe(500); }
    finally {
      await pool.query('DROP TRIGGER fail_cash_audit ON audit_logs');
      await pool.query('DROP FUNCTION fail_cash_audit()');
    }
    expect(Number((await pool.query('SELECT count(*) FROM cash_entries WHERE amount=9')).rows[0].count)).toBe(0);
    expect(Number((await pool.query('SELECT count(*) FROM idempotency WHERE key=$1',[rollbackKey])).rows[0].count)).toBe(0);
    expect((await post({direction:'in',method:'cash',amount:9,category:'other_income'},rollbackKey)).statusCode).toBe(201);
  });

  it('nets returns against revenue, cost and collections, with end-of-window debt',async()=>{
    const sale=(await pool.query(`INSERT INTO sales(subtotal,discount,total,cost,actor) VALUES (100,0,100,60,$1) RETURNING id`,[actor])).rows[0].id;
    const payment=(await pool.query(`INSERT INTO payments(sale_id,method,amount,actor) VALUES ($1,'bank',70,$2) RETURNING id`,[sale,actor])).rows[0].id;
    await pool.query(`INSERT INTO cash_entries(payment_id,direction,method,amount,category,actor) VALUES ($1,'in','bank',70,'sale',$2)`,[payment,actor]);
    const reversal=(await pool.query(`INSERT INTO returns(sale_id,kind,reason,disposition,method,total,cost,refund,debt_reduction,actor)
      VALUES ($1,'return','test','available','cash',50,30,20,30,$2) RETURNING id`,[sale,actor])).rows[0].id;
    await pool.query(`INSERT INTO cash_entries(return_id,direction,method,amount,category,actor) VALUES ($1,'out','cash',20,'sale_refund',$2)`,[reversal,actor]);
    const supplier=(await pool.query("INSERT INTO suppliers(name) VALUES ('Cash reconciliation supplier') RETURNING id")).rows[0].id;
    const purchase=(await pool.query(`INSERT INTO purchases(supplier_id,supplier_name,extra_cost,total,actor) VALUES ($1,'supplier',0,20,$2) RETURNING id`,[supplier,actor])).rows[0].id;
    const supplierPayment=(await pool.query(`INSERT INTO payments(purchase_id,method,amount,actor) VALUES ($1,'cash',20,$2) RETURNING id`,[purchase,actor])).rows[0].id;
    await pool.query(`INSERT INTO cash_entries(payment_id,direction,method,amount,category,actor) VALUES ($1,'out','cash',20,'supplier_payment',$2)`,[supplierPayment,actor]);
    const purchaseReturn=(await pool.query(`INSERT INTO purchase_returns(purchase_id,reason,method,total,refund,debt_reduction,actor)
      VALUES ($1,'test','bank',5,5,0,$2) RETURNING id`,[purchase,actor])).rows[0].id;
    await pool.query(`INSERT INTO cash_entries(purchase_return_id,direction,method,amount,category,actor) VALUES ($1,'in','bank',5,'purchase_refund',$2)`,[purchaseReturn,actor]);
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const report=(await getReport(day)).json();
    expect(report).toMatchObject({revenue:50,cost:30,gross_profit:20,collected:50,expenses:3,customer_debt:0,supplier_debt:0});
    expect(report.daily).toContainEqual({date:day,revenue:50,cost:30,gross_profit:20});
    const cash=(await app.inject({url:'/api/cash',headers:{cookie}})).json();
    const sums=(await pool.query(`SELECT method,sum(amount::numeric*CASE direction WHEN 'in' THEN 1 ELSE -1 END)::text balance FROM cash_entries GROUP BY method`)).rows;
    expect(cash.cash_balance).toBe(Number(sums.find(row=>row.method==='cash')?.balance??0));
    expect(cash.bank_balance).toBe(Number(sums.find(row=>row.method==='bank')?.balance??0));
  });

  it('uses inclusive Ho Chi Minh calendar dates and excludes the following midnight',async()=>{
    const from='2026-04-10', end='2026-04-12';
    const inside='2026-04-09T17:00:00.000Z', outside='2026-04-11T17:00:00.000Z';
    await pool.query(`INSERT INTO sales(subtotal,discount,total,cost,actor,created_at) VALUES (10,0,10,3,$1,$2),(99,0,99,90,$1,$3)`,[actor,inside,outside]);
    const report=(await getReport(from,'2026-04-11')).json();
    expect(report.revenue).toBe(10);
    expect(report.cost).toBe(3);
    expect(report.daily).toHaveLength(2);
    expect(report.daily.map((row:{date:string})=>row.date)).toEqual([from,'2026-04-11']);
  });
});
