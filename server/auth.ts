import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction, type Database } from './db.js';
import { ApiError } from './errors.js';

const scryptOptions = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, scryptOptions, (error, key) => error ? reject(error) : resolve(key));
});
const cookieName = 'qlchdt_session';
const lifetimeSeconds = 12 * 60 * 60;
const loginRateLimitMax = process.env.NODE_ENV === 'test' && process.env.E2E_SERVER === '1' ? 1000 : 5;
export type User = { id: string; username: string };
declare module 'fastify' { interface FastifyRequest { user: User | null } }

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt);
  return `scrypt:131072:8:1:${salt}:${key.toString('hex')}`;
}

async function matches(password: string, stored: string) {
  const [algorithm, n, r, p, salt, encoded] = stored.split(':');
  if (algorithm !== 'scrypt' || n !== '131072' || r !== '8' || p !== '1'
    || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(encoded ?? '')) return false;
  const candidate = await scrypt(password, salt);
  return timingSafeEqual(candidate, Buffer.from(encoded, 'hex'));
}

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function bootstrapManager(pool: Database, username: string | undefined, password: string | undefined) {
  return transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('qlchdt:manager',0))");
    if ((await client.query('SELECT id FROM users')).rowCount) return;
    const credentials = z.object({
      username: z.string().trim().min(1).max(100), password: z.string().min(12).max(1024)
        .refine(value => !value.startsWith('CHANGE_ME'), 'Set a real ADMIN_PASSWORD'),
    }).parse({ username, password });
    await client.query('INSERT INTO users(username,password_hash) VALUES ($1,$2)',
      [credentials.username, await hashPassword(credentials.password)]);
  });
}

export function registerAuth(app: FastifyInstance, pool: Database, origin: string, secure: boolean) {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (path !== '/api' && !path.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    const publicRoute = path === '/api/health' && request.method === 'GET'
      || path === '/api/auth/login' && request.method === 'POST';
    if (!publicRoute) {
      const token = request.cookies[cookieName];
      if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new ApiError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập');
      const result = await pool.query<User>(`SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at > now()`, [tokenHash(token)]);
      request.user = result.rows[0] ?? null;
      if (!request.user) throw new ApiError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== origin)
      throw new ApiError(403, 'ORIGIN_REJECTED', 'Nguồn gửi yêu cầu không được phép');
  });
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'strict' as const, secure };
  // Keep nonexistent usernames on the same expensive password verification path.
  const dummy = hashPassword(randomBytes(32).toString('hex'));
  app.post('/api/auth/login', { config: { rateLimit: { max: loginRateLimitMax, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const input = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(1024) }).strict().parse(request.body);
    const row = (await pool.query<User & { password_hash: string }>('SELECT id,username,password_hash FROM users WHERE username=$1', [input.username])).rows[0];
    const valid = await matches(input.password, row?.password_hash ?? await dummy);
    if (!row || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Tên đăng nhập hoặc mật khẩu không đúng');
    const token = randomBytes(32).toString('hex');
    await transaction(pool, async client => {
      await client.query('DELETE FROM sessions WHERE expires_at <= now()');
      const oldToken = request.cookies[cookieName];
      if (oldToken) await client.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(oldToken)]);
      await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '12 hours')", [tokenHash(token), row.id]);
    });
    reply.setCookie(cookieName, token, { ...cookieOptions, maxAge: lifetimeSeconds });
    return { id: row.id, username: row.username };
  });
  app.get('/api/auth/me', async request => request.user);
  app.post('/api/auth/logout', async (request, reply) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(request.cookies[cookieName]!)]);
    reply.clearCookie(cookieName, cookieOptions);
    return { ok: true };
  });
}
