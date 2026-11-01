import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: resolve(import.meta.dirname, '../.env'), quiet: true });
assert(process.env.DATABASE_URL && process.env.TEST_DATABASE_URL, 'Thiếu cấu hình database.');
const app = new URL(process.env.DATABASE_URL);
const test = new URL(process.env.TEST_DATABASE_URL);
assert.notEqual(app.pathname, test.pathname, 'Database test phải tách khỏi database sử dụng.');
assert(decodeURIComponent(test.pathname).endsWith('_test'), 'Tên database test phải kết thúc _test.');
for (const url of [app, test]) {
  const client = new pg.Client({ connectionString: url.href });
  await client.connect();
  try {
    const { rows: [role] } = await client.query(`SELECT current_database() AS database,
      rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user`);
    assert.equal(`/${role.database}`, decodeURIComponent(url.pathname));
    assert.equal(role.rolsuper, false, 'Ứng dụng không được dùng superuser.');
    assert.equal(role.rolcreatedb, false);
    assert.equal(role.rolcreaterole, false);
    const bootstrap = await client.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='qlchdt'");
    assert.equal(bootstrap.rows[0]?.rolcanlogin, false, 'Tài khoản bootstrap phải vô hiệu hóa đăng nhập.');
  } finally { await client.end(); }
}
console.log('PASS: hai database kết nối được, tách biệt, tài khoản ứng dụng không có quyền quản trị cụm.');
