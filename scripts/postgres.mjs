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
  const result = spawnSync(join(bin, `${name}.exe`), args, {
    encoding: 'utf8', windowsHide: true,
    // pg_ctl's Windows child retains pipes; ignore them so startup can finish.
    stdio: name === 'pg_ctl' ? 'ignore' : 'pipe',
  });
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.stdout || result.error}`);
  return result.stdout ?? `${name}: OK`;
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
  if (url.hostname !== '127.0.0.1' || url.port !== String(port) || !['qlchdt', 'qlchdt_app'].includes(url.username)) {
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
    const adminFile = join(local, 'postgres-admin.json');
    const existingAdmin = existsSync(adminFile) ? JSON.parse(readFileSync(adminFile, 'utf8')) : null;
    if (existingAdmin) {
      url.username = 'qlchdt_admin';
      url.password = existingAdmin.password;
    }
    const client = new pg.Client({ connectionString: url.href });
    await client.connect();
    try {
      for (const name of ['qlchdt', 'qlchdt_test']) {
        const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
        if (!result.rowCount) await client.query(`CREATE DATABASE ${name} OWNER qlchdt`);
      }
      if (!existingAdmin) {
        const adminPassword = randomBytes(24).toString('hex');
        const sql = await client.query("SELECT format('CREATE ROLE qlchdt_admin LOGIN SUPERUSER PASSWORD %L', $1::text) AS sql", [adminPassword]);
        await client.query(sql.rows[0].sql);
        writeFileSync(adminFile, JSON.stringify({ password: adminPassword }), { mode: 0o600 });
      }
      // PostgreSQL's bootstrap role cannot be demoted; use a separate runtime role.
      const appUrl = new URL(process.env.DATABASE_URL);
      if (!(await client.query("SELECT 1 FROM pg_roles WHERE rolname='qlchdt_app'")).rowCount) {
        const sql = await client.query("SELECT format('CREATE ROLE qlchdt_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', $1::text) AS sql", [decodeURIComponent(appUrl.password)]);
        await client.query(sql.rows[0].sql);
      }
      for (const name of ['qlchdt', 'qlchdt_test']) {
        await client.query(`ALTER DATABASE ${name} OWNER TO qlchdt_app`);
        const ownerUrl = new URL(url.href);
        ownerUrl.pathname = `/${name}`;
        const owner = new pg.Client({ connectionString: ownerUrl.href });
        await owner.connect();
        try {
          const objects = await owner.query(`
            SELECT format('ALTER TABLE %I.%I OWNER TO qlchdt_app', n.nspname, c.relname) AS sql
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
            WHERE n.nspname='public' AND r.rolname='qlchdt' AND c.relkind IN ('r','p')
            UNION ALL
            SELECT format('ALTER DOMAIN %I.%I OWNER TO qlchdt_app', n.nspname,t.typname)
            FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_roles r ON r.oid=t.typowner
            WHERE n.nspname='public' AND r.rolname='qlchdt' AND t.typtype='d'
            UNION ALL
            SELECT format('ALTER FUNCTION %s OWNER TO qlchdt_app',p.oid::regprocedure)
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
            WHERE n.nspname='public' AND r.rolname='qlchdt' AND p.prokind='f'`);
          for (const object of objects.rows) await owner.query(object.sql);
        }
        finally { await owner.end(); }
      }
      if (appUrl.username === 'qlchdt') {
        const envFile = join(root, '.env');
        writeFileSync(envFile, readFileSync(envFile, 'utf8').replaceAll('postgresql://qlchdt:', 'postgresql://qlchdt_app:'), { mode: 0o600 });
      }
      await client.query('ALTER ROLE qlchdt NOLOGIN');
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
