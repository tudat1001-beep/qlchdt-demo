import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { uuid } from '../shared/validation.js';
import { transaction, type Database } from './db.js';
import { ApiError } from './errors.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function idempotent<T>(pool: Database, key: unknown, actor: string, operation: string, payload: unknown,
  statusCode: number, work: (client: PoolClient) => Promise<T>): Promise<{ statusCode: number; body: T }> {
  const parsedKey = uuid.parse(key);
  const hash = createHash('sha256').update(canonical(payload)).digest('hex');
  return transaction(pool, async client => {
    // The lock and saved result must share the business transaction, including rollback.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`idempotency:${parsedKey}`]);
    const previous = (await client.query('SELECT * FROM idempotency WHERE key=$1', [parsedKey])).rows[0];
    if (previous) {
      if (previous.actor !== actor || previous.operation !== operation || previous.payload_hash !== hash)
        throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Khóa chống ghi trùng đã được dùng cho nội dung khác');
      return { statusCode: previous.status_code, body: previous.response as T };
    }
    const body = await work(client);
    await client.query('INSERT INTO idempotency(key,actor,operation,payload_hash,status_code,response) VALUES ($1,$2,$3,$4,$5,$6)',
      [parsedKey, actor, operation, hash, statusCode, JSON.stringify(body)]);
    return { statusCode, body };
  });
}

export async function audit(client: PoolClient, actor: string, action: string, entity: string, id: string, details: unknown) {
  await client.query('INSERT INTO audit_logs(actor,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5)',
    [actor, action, entity, id, JSON.stringify(details)]);
}
