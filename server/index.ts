import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
pool.on('error', () => console.error('Unexpected idle database connection error'));
const app = await buildApp({ pool, origin: config.APP_ORIGIN, secureCookies: config.NODE_ENV === 'production', logger: true });
app.addHook('onClose', async () => { await pool.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
try { await app.listen({ host: config.HOST, port: config.PORT }); }
catch { console.error('Server could not start'); await app.close(); process.exitCode = 1; }
