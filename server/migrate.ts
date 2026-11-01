import 'dotenv/config';
import { createPool } from './db.js';
import { migrate } from './migrations.js';
import { bootstrapManager } from './auth.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const pool = createPool(url);
try {
  const versions = await migrate(pool);
  await bootstrapManager(pool, process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
  console.log(`Database ready; ${versions.length} new migration(s)`);
} catch {
  console.error('Migration/bootstrap failed; verify database access and ADMIN credentials (minimum 12 characters)');
  process.exitCode = 1;
} finally { await pool.end(); }
