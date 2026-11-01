import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { partyFields, partyPatch, searchQuery, uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { audit, idempotent } from './idempotency.js';
import { paymentSelect,purchaseSelect,saleSelect } from './documents.js';

function partySelect(table:'customers'|'suppliers') {
  return table==='suppliers'
    ? `SELECT p.*,(SELECT coalesce(sum(d.debt),0)::money_vnd FROM (${purchaseSelect}) d WHERE d.supplier_id=p.id) AS debt FROM suppliers p`
    : `SELECT p.*,(SELECT coalesce(sum(d.debt),0)::money_vnd FROM (${saleSelect}) d WHERE d.customer_id=p.id) AS debt FROM customers p`;
}

export function registerParties(app: FastifyInstance, pool: Database) {
  for (const table of ['customers', 'suppliers'] as const) {
    app.get(`/api/${table}`, async request => {
      const { q } = searchQuery.parse(request.query);
      return { items: (await pool.query(`${partySelect(table)}
        WHERE ($1::text IS NULL OR concat_ws(' ',name,phone,address,note) ILIKE '%' || $1 || '%') ORDER BY created_at,id`, [q ?? null])).rows };
    });
    app.get(`/api/${table}/:id`, async request => {
      const { id } = z.object({ id: uuid }).parse(request.params);
      const row = (await pool.query(`${partySelect(table)} WHERE p.id=$1`, [id])).rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy khách hàng hoặc nhà cung cấp');
      if (table==='customers') {
        const sales=(await pool.query(`${saleSelect} WHERE s.customer_id=$1 ORDER BY s.created_at DESC,s.id`,[id])).rows;
        const payments=(await pool.query(`${paymentSelect} JOIN sales d ON d.id=p.sale_id WHERE d.customer_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
        const returns=(await pool.query('SELECT r.* FROM returns r JOIN sales s ON s.id=r.sale_id WHERE s.customer_id=$1 ORDER BY r.created_at,r.id',[id])).rows;
        return {...row,sales,payments,returns,warranties:[]};
      }
      const purchases = (await pool.query(`${purchaseSelect} WHERE p.supplier_id=$1 ORDER BY p.created_at DESC,p.id`,[id])).rows;
      const payments = (await pool.query(`${paymentSelect} JOIN purchases d ON d.id=p.purchase_id WHERE d.supplier_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
      return { ...row,purchases,payments };
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
        return (await client.query(`${partySelect(table)} WHERE p.id=$1`,[id])).rows[0];
      });
      return reply.code(result.statusCode).send(result.body);
    });
  }
}
