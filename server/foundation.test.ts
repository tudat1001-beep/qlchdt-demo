import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { bootstrapManager, tokenHash } from './auth.js';
import { createPool, transaction, type Database } from './db.js';
import { idempotent } from './idempotency.js';
import { migrate } from './migrations.js';

const origin = 'http://127.0.0.1:5173';
const username = 'integration-manager';
const password = 'test-only-password-123!';
const schema = `test_${randomUUID().replaceAll('-', '')}`;
let admin: Database | undefined;
let schemaCreated = false;
let pool: Database;
let app: FastifyInstance;
let cookie: string;
let actor: string;
const product = (sku = randomUUID()) => ({ sku, name: 'Integration accessory', kind: 'ACCESSORY', sale_price: 200000, min_stock: 1 });
const headers = (key: string = randomUUID()) => ({ cookie, origin, 'idempotency-key': key });

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !decodeURIComponent(new URL(url).pathname.slice(1)).endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a dedicated _test database');
  admin = createPool(url);
  const name = (await admin.query('SELECT current_database() AS name')).rows[0].name as string;
  if (!name.endsWith('_test')) throw new Error('Refusing integration setup outside a _test database');
  await admin.query(`CREATE SCHEMA ${schema}`);
  schemaCreated = true;
  pool = createPool(url, { options: `-c search_path=${schema},public` });
  await migrate(pool);
  await bootstrapManager(pool, username, password);
  app = await buildApp({ pool, origin });
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username, password } });
  expect(response.statusCode).toBe(200);
  cookie = response.headers['set-cookie']!.toString().split(';')[0];
  actor = response.json().id;
});

afterAll(async () => {
  await app?.close();
  await pool?.end();
  if (admin) {
    if (schemaCreated) await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

describe('versioned migrations and database guards', () => {
  it('serializes repeat migrations and preserves existing records', async () => {
    expect(await Promise.all([migrate(pool), migrate(pool)])).toEqual([[], []]);
    expect((await pool.query('SELECT count(*) FROM users')).rows[0].count).toBe(1);
    expect((await pool.query('SELECT version FROM schema_migrations')).rows).toHaveLength(3);
  });
  it('rejects checksum drift rather than silently changing an applied migration', async () => {
    const {version,checksum} = (await pool.query('SELECT version,checksum FROM schema_migrations ORDER BY version')).rows[0];
    await pool.query("UPDATE schema_migrations SET checksum='tampered' WHERE version=$1",[version]);
    try { await expect(migrate(pool)).rejects.toThrow('Migration checksum changed'); }
    finally { await pool.query('UPDATE schema_migrations SET checksum=$1 WHERE version=$2', [checksum,version]); }
  });
  it('bootstraps exactly one scrypt manager without resetting the existing password', async () => {
    await bootstrapManager(pool, 'another', 'another-password-123');
    const rows = (await pool.query('SELECT username,password_hash FROM users')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe(username);
    expect(rows[0].password_hash).toMatch(/^scrypt:131072:8:1:[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(rows[0].password_hash).not.toContain(password);
    await expect(pool.query("INSERT INTO users(username,password_hash) VALUES ('second','unused')")).rejects.toMatchObject({ code: '23505' });
  });
  it('enforces money and audit history at the database boundary', async () => {
    await expect(pool.query("INSERT INTO products(sku,name,kind,sale_price) VALUES ('negative','bad','PHONE',-1)")).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO products(sku,name,kind,sale_price) VALUES ('unsafe','bad','PHONE',9007199254740992)")).rejects.toMatchObject({ code: '23514' });
    const id = randomUUID();
    await pool.query("INSERT INTO audit_logs(actor,action,entity_type,entity_id,details) VALUES ($1,'test','test',$2,'{}')", [actor, id]);
    await expect(pool.query('DELETE FROM audit_logs WHERE entity_id=$1', [id])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('authentication and origin boundaries', () => {
  it('keeps health public and gates every data route', async () => {
    expect((await app.inject('/api/health')).json()).toEqual({ ok: true });
    for (const url of ['/api/auth/me', '/api/products', '/api/devices', '/api/customers', '/api/suppliers','/api/purchases','/api/stock-movements','/api/sales', `/api/customers/${randomUUID()}`]) {
      const result = await app.inject(url);
      expect(result.statusCode, url).toBe(401);
      expect(result.headers['cache-control']).toBe('no-store');
    }
    for (const url of ['/api/products','/api/purchases','/api/sales','/api/payments'])
      expect((await app.inject({ method: 'POST', url, headers: { origin }, payload: product() })).statusCode).toBe(401);
  });
  it('sets HttpOnly strict session cookie and persists only its hash', async () => {
    const other = await buildApp({ pool, origin });
    try {
      const result = await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username, password } });
      expect(result.statusCode).toBe(200);
      expect(result.json()).toEqual({ id: actor, username });
      const setCookie = result.headers['set-cookie']!.toString();
      expect(setCookie).toContain('HttpOnly'); expect(setCookie).toContain('SameSite=Strict'); expect(setCookie).toContain('Max-Age=43200');
      const token = setCookie.split(';')[0].split('=')[1];
      const row = (await pool.query('SELECT token_hash FROM sessions WHERE token_hash=$1', [tokenHash(token)])).rows[0];
      expect(row.token_hash).not.toBe(token);
      expect((await other.inject({ url: '/api/auth/me', headers: { cookie: setCookie.split(';')[0] } })).json()).toEqual({ id: actor, username });
    } finally { await other.close(); }
  });
  it('rejects bad credentials, missing origin, hostile origin and malformed login', async () => {
    const other = await buildApp({ pool, origin });
    try {
      for (const badOrigin of [undefined, 'https://evil.example', `${origin}.evil.example`]) {
        expect((await other.inject({ method: 'POST', url: '/api/auth/login', headers: badOrigin ? { origin: badOrigin } : {}, payload: { username, password } })).statusCode).toBe(403);
      }
      for (const credentials of [{ username, password: 'wrong' }, { username: 'missing-user', password }]) {
        const result = await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: credentials });
        expect(result.statusCode).toBe(401); expect(result.json().error.code).toBe('INVALID_CREDENTIALS');
      }
      expect((await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username } })).statusCode).toBe(400);
    } finally { await other.close(); }
  });
  it('rate limits repeated login attempts', async () => {
    const other = await buildApp({ pool, origin });
    try {
      for (let i = 0; i < 5; i++) expect((await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username, password: 'wrong' } })).statusCode).toBe(401);
      const result = await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username, password } });
      expect(result.statusCode).toBe(429); expect(result.json().error.code).toBe('RATE_LIMITED');
    } finally { await other.close(); }
  });
  it('rejects forged/expired sessions and revokes a session on logout', async () => {
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: 'qlchdt_session=' + 'a'.repeat(64) } })).statusCode).toBe(401);
    const token = 'b'.repeat(64);
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()-interval '1 second')", [tokenHash(token), actor]);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: `qlchdt_session=${token}` } })).statusCode).toBe(401);
    const result = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { username, password } });
    const temporary = result.headers['set-cookie']!.toString().split(';')[0];
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie: temporary }, payload: {} });
    expect(logout.statusCode).toBe(200); expect(logout.headers['set-cookie']).toContain('Max-Age=0');
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: temporary } })).statusCode).toBe(401);
  });
  it('checks origin on authenticated mutations including logout', async () => {
    for (const url of ['/api/products', '/api/customers', '/api/suppliers','/api/purchases','/api/sales','/api/payments', '/api/auth/logout']) {
      for (const value of [undefined, 'https://evil.example']) {
        expect((await app.inject({ method: 'POST', url, headers: { cookie, ...(value ? { origin: value } : {}) }, payload: {} })).statusCode).toBe(403);
      }
    }
    expect((await app.inject({ method: 'PATCH', url: `/api/products/${randomUUID()}`, headers: { cookie, origin: 'https://evil.example' }, payload: { name: 'wrong' } })).statusCode).toBe(403);
  });
  it('requires HTTPS and marks production session cookies Secure', async () => {
    await expect(buildApp({ pool, origin, secureCookies: true })).rejects.toThrow('HTTPS');
    const other = await buildApp({ pool, origin: 'https://store.example', secureCookies: true });
    try {
      const result = await other.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://store.example' }, payload: { username, password } });
      expect(result.headers['set-cookie']).toContain('Secure');
    } finally { await other.close(); }
  });
});

describe('catalog and parties', () => {
  it('creates, filters and updates products while protecting identity', async () => {
    const input = product();
    const result = await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: input });
    expect(result.statusCode).toBe(201); expect(result.json()).toMatchObject({ ...input, stock_quantity: 0 });
    const id = result.json().id;
    expect((await app.inject({ url: `/api/products?q=${input.sku}&kind=ACCESSORY`, headers: { cookie } })).json().items).toHaveLength(1);
    const updated = await app.inject({ method: 'PATCH', url: `/api/products/${id}`, headers: headers(), payload: { name: 'Changed', sale_price: 0 } });
    expect(updated.statusCode).toBe(200); expect(updated.json()).toMatchObject({ name: 'Changed', sale_price: 0 });
    expect((await app.inject({ method: 'PATCH', url: `/api/products/${id}`, headers: headers(), payload: { sku: 'changed' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: input })).statusCode).toBe(409);
    expect((await pool.query("SELECT count(*) FROM audit_logs WHERE entity_id=$1", [id])).rows[0].count).toBe(2);
  });
  it('rejects invalid and unsafe money, unknown fields, identifiers and absent keys', async () => {
    for (const sale_price of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '123']) {
      expect((await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: { ...product(), sale_price } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: { ...product(), stock_quantity: 9 } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/products', headers: { cookie, origin }, payload: product() })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/api/products/not-uuid', headers: headers(), payload: { name: 'invalid' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/api/products/${randomUUID()}`, headers: headers(), payload: { name: 'missing' } })).statusCode).toBe(404);
  });
  it('returns safe maximum VND as a JSON number', async () => {
    const result = await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: { ...product(), sale_price: Number.MAX_SAFE_INTEGER } });
    expect(result.statusCode).toBe(201); expect(result.json().sale_price).toBe(Number.MAX_SAFE_INTEGER);
  });
  it('reads device inventory and validates filters', async () => {
    const phone = await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: { ...product(), kind: 'PHONE' } });
    const id = phone.json().id;
    await pool.query("INSERT INTO devices(imei,product_id,condition,cost,sale_price) VALUES ('123456789012345',$1,'USED',100,200)", [id]);
    const result = await app.inject({ url: `/api/devices?product_id=${id}&status=available&q=123456789012345`, headers: { cookie } });
    expect(result.json().items[0]).toMatchObject({ imei: '123456789012345', cost: 100, sale_price: 200, status: 'available', sku: phone.json().sku });
    expect((await app.inject({ url: `/api/products?q=${phone.json().sku}`, headers: { cookie } })).json().items[0].stock_quantity).toBe(1);
    expect((await app.inject({ url: '/api/devices?status=invalid', headers: { cookie } })).statusCode).toBe(400);
  });
  it.each(['customers', 'suppliers'])('creates, reads and updates %s with history foundation', async table => {
    const result = await app.inject({ method: 'POST', url: `/api/${table}`, headers: headers(), payload: { name: 'Party', phone: '0123456789', note: 'foundation' } });
    expect(result.statusCode).toBe(201); expect(result.json().debt).toBe(0);
    const id = result.json().id;
    expect((await app.inject({ url: `/api/${table}?q=0123456789`, headers: { cookie } })).json().items).toHaveLength(1);
    const updated = await app.inject({ method: 'PATCH', url: `/api/${table}/${id}`, headers: headers(), payload: { name: 'Updated party', address: 'Address' } });
    expect(updated.statusCode).toBe(200); expect(updated.json().phone).toBe('0123456789');
    const detail = (await app.inject({ url: `/api/${table}/${id}`, headers: { cookie } })).json();
    expect(detail).toMatchObject({ name: 'Updated party', debt: 0, payments: [], [table === 'customers' ? 'sales' : 'purchases']: [] });
    expect((await app.inject({ method: 'POST', url: `/api/${table}`, headers: headers(), payload: { name: ' ' } })).statusCode).toBe(400);
    expect((await app.inject({ url: `/api/${table}/${randomUUID()}`, headers: { cookie } })).statusCode).toBe(404);
  });
});

describe('atomic idempotency foundation', () => {
  it('serializes concurrent equal requests, replays equal JSON with reordered keys and rejects conflicting payloads', async () => {
    const key = randomUUID(); const input = product();
    const requests = await Promise.all(Array.from({ length: 6 }, (_, index) => app.inject({ method: 'POST', url: '/api/products', headers: headers(index % 2 ? key.toUpperCase() : key), payload: input })));
    for (const result of requests) { expect(result.statusCode).toBe(201); expect(result.json()).toEqual(requests[0].json()); }
    const reordered = Object.fromEntries(Object.entries(input).reverse());
    expect((await app.inject({ method: 'POST', url: '/api/products', headers: headers(key), payload: reordered })).json()).toEqual(requests[0].json());
    const conflict = await app.inject({ method: 'POST', url: '/api/products', headers: headers(key), payload: { ...input, name: 'conflict' } });
    expect(conflict.statusCode).toBe(409); expect(conflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((await pool.query('SELECT count(*) FROM products WHERE sku=$1', [input.sku])).rows[0].count).toBe(1);
    expect((await pool.query('SELECT count(*) FROM audit_logs WHERE entity_id=$1', [requests[0].json().id])).rows[0].count).toBe(1);
    expect((await app.inject({ method: 'POST', url: '/api/customers', headers: headers(key), payload: { name: 'cross-operation' } })).statusCode).toBe(409);
  });
  it('rolls back business rows, audit and key together; allows a clean retry', async () => {
    const key = randomUUID(); const id = randomUUID();
    await expect(idempotent(pool, key, actor, 'test-rollback', {}, 201, async client => {
      await client.query('INSERT INTO customers(id,name) VALUES ($1,$2)', [id, 'Rollback']);
      await client.query("INSERT INTO audit_logs(actor,action,entity_type,entity_id,details) VALUES ($1,'create','customers',$2,'{}')", [actor, id]);
      throw new Error('forced failure');
    })).rejects.toThrow('forced failure');
    expect((await pool.query('SELECT id FROM customers WHERE id=$1', [id])).rowCount).toBe(0);
    expect((await pool.query('SELECT id FROM audit_logs WHERE entity_id=$1', [id])).rowCount).toBe(0);
    expect((await pool.query('SELECT key FROM idempotency WHERE key=$1', [key])).rowCount).toBe(0);
    expect(await idempotent(pool, key, actor, 'test-rollback', {}, 201, async () => ({ id }))).toEqual({ statusCode: 201, body: { id } });
    await expect(transaction(pool, async client => { await client.query('SELECT 1'); throw new Error('rollback'); })).rejects.toThrow('rollback');
    expect((await pool.query('SELECT 1 AS ok')).rows[0].ok).toBe(1);
  });
  it('requires keys for PATCH and replays an update without duplicate audit', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/products', headers: headers(), payload: product() });
    const id = created.json().id;
    const url = `/api/products/${id}`;
    expect((await app.inject({ method: 'PATCH', url, headers: { cookie, origin }, payload: { name: 'Key required' } })).statusCode).toBe(400);
    const key = randomUUID();
    const first = await app.inject({ method: 'PATCH', url, headers: headers(key), payload: { name: 'Updated once' } });
    const replay = await app.inject({ method: 'PATCH', url, headers: headers(key), payload: { name: 'Updated once' } });
    expect(replay.statusCode).toBe(200); expect(replay.json()).toEqual(first.json());
    expect((await pool.query('SELECT count(*) FROM audit_logs WHERE entity_id=$1', [id])).rows[0].count).toBe(2);
  });
});

it('serves built assets and SPA routes without turning missing API routes into HTML', async () => {
  const distPath = await mkdtemp(join(tmpdir(), 'qlchdt-dist-'));
  await writeFile(join(distPath, 'index.html'), '<!doctype html><title>Production shell</title>');
  await writeFile(join(distPath, 'asset.js'), 'console.log("asset");');
  await writeFile(join(distPath, 'sw.js'), '/* service worker */');
  const other = await buildApp({ pool, origin, distPath });
  try {
    const home = await other.inject('/');
    expect(home.body).toContain('Production shell'); expect(home.headers['cache-control']).toBe('no-cache');
    expect((await other.inject('/customers')).body).toContain('Production shell');
    expect((await other.inject('/asset.js')).body).toContain('console.log');
    expect((await other.inject('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await other.inject('/missing.js')).statusCode).toBe(404);
    const response = await other.inject({ url: '/api/missing', headers: { cookie } });
    expect(response.statusCode).toBe(404); expect(response.json().error.code).toBe('NOT_FOUND'); expect(response.headers['cache-control']).toBe('no-store');
  } finally { await other.close(); await rm(distPath, { recursive: true, force: true }); }
});
