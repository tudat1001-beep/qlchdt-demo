import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { registerAuth } from './auth.js';
import { registerCatalog } from './catalog.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { registerParties } from './parties.js';
import { registerInventory } from './inventory.js';
import { registerSales } from './sales.js';
import { registerPayments } from './payments.js';
import { registerReturns } from './returns.js';

export interface AppOptions { pool: Database; origin: string; secureCookies?: boolean; logger?: boolean; distPath?: string }

export async function buildApp({ pool, origin, secureCookies = false, logger = false,
  distPath = fileURLToPath(new URL('../dist/', import.meta.url)) }: AppOptions) {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.origin !== origin || !['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('APP_ORIGIN must be an exact HTTP origin');
  if (secureCookies && parsedOrigin.protocol !== 'https:') throw new Error('Secure cookies require an HTTPS APP_ORIGIN');
  const app = Fastify({ logger: logger ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] } : false, bodyLimit: 128 * 1024 });
  app.setErrorHandler((error: Error & { code?: string; statusCode?: number }, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `Dữ liệu không hợp lệ: ${error.issues.map(issue => issue.path.join('.') || 'nội dung yêu cầu').join(', ')}` } });
    if (error instanceof ApiError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    if (error instanceof RangeError) return reply.code(422).send({ error:{code:'MONEY_RANGE',message:'Số tiền hoặc tổng tiền vượt giới hạn cho phép'} });
    if (['40P01','55P03','57014'].includes(error.code??'')) return reply.header('Retry-After','1').code(409).send({error:{code:'TRANSACTION_RETRY',message:'Giao dịch đang bận; vui lòng thử lại với cùng khóa chống ghi trùng'}});
    if (error.code === '23505') return reply.code(409).send({ error: { code: 'DUPLICATE', message: 'Bản ghi đã tồn tại' } });
    if (['23514', '23503', '22003'].includes(error.code ?? '')) return reply.code(422).send({ error: { code: 'INVALID_TRANSITION', message: 'Thao tác không đáp ứng quy tắc dữ liệu' } });
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500)
      return reply.code(error.statusCode).send({ error: { code: error.statusCode === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST', message: error.statusCode === 429 ? 'Quá nhiều lần thử; vui lòng thử lại sau' : 'Yêu cầu không hợp lệ' } });
    // Log only the error class/code: database errors can contain private row values.
    request.log.error({ errorCode: error.code, errorName: error.name }, 'Request failed');
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Lỗi xử lý tại máy chủ' } });
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  app.addHook('onSend', async (request, reply) => {
    if (request.url.split('?')[0] === '/api' || request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
  });
  registerAuth(app, pool, origin, secureCookies);
  app.get('/api/health', async () => { await pool.query('SELECT 1'); return { ok: true }; });
  registerCatalog(app, pool);
  registerParties(app, pool);
  registerInventory(app,pool);
  registerSales(app,pool);
  registerPayments(app,pool);
  registerReturns(app,pool);
  if (existsSync(`${distPath}/index.html`)) await app.register(staticFiles, {
    root: distPath, wildcard: false,
    setHeaders(reply, path) {
      if (/(?:^|[\\/])(?:index\.html|sw\.js|service-worker\.js)$/.test(path)) reply.header('Cache-Control', 'no-cache');
    },
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.split('?')[0].startsWith('/api') && !request.url.split('?')[0].includes('.') && existsSync(`${distPath}/index.html`))
      return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn' } });
  });
  return app;
}
