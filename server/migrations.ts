import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { transaction, type Database } from './db.js';

export async function migrate(pool: Database) {
  const directory = new URL('./migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(name => /^\d{3}_[a-z_]+\.sql$/.test(name)).sort();
  return transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('qlchdt:migrations',0))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query<{ version: string; checksum: string }>('SELECT version,checksum FROM schema_migrations ORDER BY version');
    for (const row of applied.rows) if (!names.includes(row.version)) throw new Error(`Missing applied migration ${row.version}`);
    const completed: string[] = [];
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const old = applied.rows.find(row => row.version === name);
      if (old) {
        if (old.checksum !== checksum) throw new Error(`Migration checksum changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version,checksum) VALUES ($1,$2)', [name, checksum]);
      completed.push(name);
    }
    return completed;
  });
}
