import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';

const root = resolve(import.meta.dirname, '..');
dotenv.config({ path: resolve(root, '.env'), quiet: true });
const url = process.env.TEST_DATABASE_URL;
assert(url && decodeURIComponent(new URL(url).pathname).endsWith('_test'), 'E2E yêu cầu database _test riêng.');
assert.notEqual(decodeURIComponent(new URL(url).pathname), decodeURIComponent(new URL(process.env.DATABASE_URL).pathname), 'Không chạy E2E trên database sử dụng.');
const client = new pg.Client({ connectionString: url });
await client.connect();
try { assert((await client.query('SELECT current_database() AS name')).rows[0].name.endsWith('_test')); }
finally { await client.end(); }

const env = {
  ...process.env, DATABASE_URL: url, NODE_ENV: 'test', E2E_SERVER: '1', PORT: '3002', HOST: '127.0.0.1',
  APP_ORIGIN: 'http://127.0.0.1:5174', WEB_PORT: '5174', API_PROXY: 'http://127.0.0.1:3002',
};
const migrate = spawnSync(process.execPath, ['--import', 'tsx', 'server/migrate.ts'], {
  cwd: root, env, stdio: 'inherit', windowsHide: true,
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: root, env, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { cwd: root, env, stdio: 'inherit', windowsHide: true }),
];
function stop() { children.forEach(child => child.kill()); }
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
children.forEach(child => child.once('exit', code => { stop(); process.exitCode = code ?? 0; }));
