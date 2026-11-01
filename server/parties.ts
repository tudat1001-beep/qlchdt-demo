import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { partyFields, partyPatch, searchQuery, uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { audit, idempotent } from './idempotency.js';

export function registerParties(app: FastifyInstance, pool: Database) {
  for (const table of ['customers', 'suppliers'] as const) {
    app.get(`/api/${table}`, async request => {
      const { q } = searchQuery.parse(request.query);
      // shortcut: zero debt/empty history in T-01, derive from documents in T-02/03.
      return { items: (await pool.query(`SELECT *,0::bigint AS debt FROM ${table}
        WHERE ($1::text IS NULL OR concat_ws(' ',name,phone,address,note) ILIKE '%' || $1 || '%') ORDER BY created_at,id`, [q ?? null])).rows };
    });
    app.get(`/api/${table}/:id`, async request => {
      const { id } = z.object({ id: uuid }).parse(request.params);
      const row = (await pool.query(`SELECT *,0::bigint AS debt FROM ${table} WHERE id=$1`, [id])).rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy khách hàng hoặc nhà cung cấp');
      return { ...row, ...(table === 'customers' ? { sales: [], warranties: [] } : { purchases: [] }), payments: [] };
    });
    app.post(`/api/${table}`, async (request, reply) => {
      const input = partyFields.parse(request.body);
      const result = await idempotent(pool, request.headers['idempotency-key'], request.user!.id, `POST /${table}`, request.body, 201, async client => {
        const row = (await client.query(`INSERT INTO ${table}(name,phone,address,note) VALUES ($1,$2,$3,$4) RETURNING *,0::bigint AS debt`,
          [input.name, input.phone ?? '', input.address ?? '', input.note ?? ''])).rows[0];
        await audit(client, request.user!.id, 'create', table, row.id, row);
        return row;
      });
      return reply.code(result.statusCode).send(result.body);
    });
    app.patch(`/api/${table}/:id`, async (request, reply) => {
      const { id } = z.object({ id: uuid }).parse(request.params);
      const input = partyPatch.parse(request.body);
      const result = await idempotent(pool, request.headers['idempotency-key'], request.user!.id, `PATCH /${table}/${id}`, request.body, 200, async client => {
        const entries = Object.entries(input);
        const row = (await client.query(`UPDATE ${table} SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(',')},updated_at=now() WHERE id=$1 RETURNING *,0::bigint AS debt`,
          [id, ...entries.map(([, value]) => value)])).rows[0];
        if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy khách hàng hoặc nhà cung cấp');
        await audit(client, request.user!.id, 'update', table, id, input);
        return row;
      });
      return reply.code(result.statusCode).send(result.body);
    });
  }
}
