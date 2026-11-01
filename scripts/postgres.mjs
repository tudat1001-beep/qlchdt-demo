import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

const root = resolve(import.meta.dirname, '..');
const local = join(root, '.local');
const data = join(local, 'postgres');
const bin = process.env.PG_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
const port = 55439;
mkdirSync(local, { recursive: true });
dotenv.config({ path: join(root, '.env'), quiet: true });

function run(name, args) {
  const result = spawnSync(join(bin, `${name}.exe`), args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout || result.error}`);
  return result.stdout;
}

const action = process.argv[2] ?? 'start';
if (action === 'setup') {
  if (!existsSync(join(root, '.env'))) {
    const password = randomBytes(24).toString('hex');
    const adminPassword = randomBytes(15).toString('base64url');
    writeFileSync(join(root, '.env'), [
      `DATABASE_URL=postgresql://qlchdt:${password}@127.0.0.1:${port}/qlchdt`,
      `TEST_DATABASE_URL=postgresql://qlchdt:${password}@127.0.0.1:${port}/qlchdt_test`,
      'ADMIN_USERNAME=admin', `ADMIN_PASSWORD=${adminPassword}`, 'PORT=3001',
      'HOST=127.0.0.1', 'APP_ORIGIN=http://127.0.0.1:5173', 'NODE_ENV=development', '',
    ].join('\n'), { mode: 0o600 });
    writeFileSync(join(local, 'credentials.txt'), `QLCHDT — tài khoản quản lý local\nĐăng nhập: admin\nMật khẩu: ${adminPassword}\nURL: http://127.0.0.1:5173\nGiữ file này riêng tư.\n`, { mode: 0o600 });
    dotenv.config({ path: join(root, '.env'), override: true, quiet: true });
  }
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== String(port) || url.username !== 'qlchdt') {
    throw new Error('Setup chỉ quản lý cụm qlchdt local cổng 55439. Kiểm tra .env; không thay database ngoài.');
  }
  if (!existsSync(join(data, 'PG_VERSION'))) {
    const pwfile = join(local, 'postgres-password');
    writeFileSync(pwfile, decodeURIComponent(url.password), { mode: 0o600 });
    try {
      console.log(run('initdb', ['-D', data, '-U', 'qlchdt', '--pwfile', pwfile, '--auth', 'scram-sha-256', '--encoding', 'UTF8', '--locale', 'C']));
    } finally {
      writeFileSync(pwfile, '');
    }
    writeFileSync(join(data, 'postgresql.auto.conf'), `listen_addresses = '127.0.0.1'\nport = ${port}\nmax_connections = 50\n`);
  }
}
if (!existsSync(join(data, 'PG_VERSION'))) throw new Error('Chạy npm run db:setup trước.');
if (action === 'stop') {
  console.log(run('pg_ctl', ['-D', data, 'stop', '-m', 'fast', '-w']));
} else if (action === 'setup' || action === 'start') {
  const status = spawnSync(join(bin, 'pg_ctl.exe'), ['-D', data, 'status'], { windowsHide: true });
  if (status.status !== 0) console.log(run('pg_ctl', ['-D', data, '-l', join(local, 'postgres.log'), 'start', '-w']));
  if (action === 'setup') {
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/postgres';
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    try {
      for (const name of ['qlchdt', 'qlchdt_test']) {
        const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
        if (!result.rowCount) await client.query(`CREATE DATABASE ${name}`);
      }
    } finally { await client.end(); }
    console.log('PostgreSQL riêng đã sẵn sàng; .env và tài khoản ở .local/credentials.txt. Không seed dữ liệu kinh doanh.');
  }
} else if (action === 'backup') {
  const target = join(local, `backup-${new Date().toISOString().replaceAll(':', '-')}.dump`);
  const url = new URL(process.env.DATABASE_URL);
  const result = spawnSync(join(bin, 'pg_dump.exe'), ['--host', url.hostname, '--port', url.port, '--username', decodeURIComponent(url.username), '--dbname', url.pathname.slice(1), '--format', 'custom', '--file', target], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: 'utf8', windowsHide: true,
  });
  if (result.status !== 0) throw new Error(result.stderr || String(result.error));
  console.log(`Sao lưu: ${target}`);
} else throw new Error('Dùng setup, start, stop hoặc backup.');
