import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productFields, productPatch, searchQuery, uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { audit, idempotent } from './idempotency.js';

const productSelect = `SELECT p.*,(CASE WHEN p.kind='PHONE' THEN
  (SELECT count(*) FROM devices d WHERE d.product_id=p.id AND d.status='available') ELSE
  (SELECT coalesce(sum(remaining_quantity),0) FROM accessory_lots a WHERE a.product_id=p.id) END)::money_vnd AS stock_quantity FROM products p`;

export function registerCatalog(app: FastifyInstance, pool: Database) {
  app.get('/api/products', async request => {
    const query = searchQuery.extend({ kind: z.enum(['PHONE', 'ACCESSORY']).optional() }).parse(request.query);
    return { items: (await pool.query(`${productSelect} WHERE ($1::text IS NULL OR concat_ws(' ',p.sku,p.name,p.brand,p.model,p.variant,p.color,p.storage) ILIKE '%' || $1 || '%')
      AND ($2::text IS NULL OR p.kind=$2) ORDER BY p.created_at,p.id`, [query.q ?? null, query.kind ?? null])).rows };
  });
  app.post('/api/products', async (request, reply) => {
    const input = productFields.parse(request.body);
    const result = await idempotent(pool, request.headers['idempotency-key'], request.user!.id, 'POST /products', request.body, 201, async client => {
      const row = (await client.query(`INSERT INTO products(sku,name,kind,brand,model,variant,color,storage,sale_price,min_stock)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [input.sku, input.name, input.kind, input.brand ?? '', input.model ?? '', input.variant ?? '', input.color ?? '', input.storage ?? '', input.sale_price, input.min_stock ?? 0])).rows[0];
      await audit(client, request.user!.id, 'create', 'product', row.id, row);
      return { ...row, stock_quantity: 0 };
    });
    return reply.code(result.statusCode).send(result.body);
  });
  app.patch('/api/products/:id', async (request, reply) => {
    const { id } = z.object({ id: uuid }).parse(request.params);
    const input = productPatch.parse(request.body);
    const result = await idempotent(pool, request.headers['idempotency-key'], request.user!.id, `PATCH /products/${id}`, request.body, 200, async client => {
      const entries = Object.entries(input);
      const row = (await client.query(`UPDATE products SET ${entries.map(([key], i) => `${key}=$${i + 2}`).join(',')},updated_at=now() WHERE id=$1 RETURNING *`,
        [id, ...entries.map(([, value]) => value)])).rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy sản phẩm');
      await audit(client, request.user!.id, 'update', 'product', id, input);
      return (await client.query(`${productSelect} WHERE p.id=$1`, [id])).rows[0];
    });
    return reply.code(result.statusCode).send(result.body);
  });
  app.get('/api/devices', async request => {
    const query = searchQuery.extend({ product_id: uuid.optional(), status: z.enum(['available', 'sold', 'quarantine', 'returned_supplier']).optional() }).parse(request.query);
    return { items: (await pool.query(`SELECT d.*,p.name AS product_name,p.sku FROM devices d JOIN products p ON p.id=d.product_id
      WHERE ($1::text IS NULL OR concat_ws(' ',d.imei,p.sku,p.name) ILIKE '%' || $1 || '%')
      AND ($2::uuid IS NULL OR d.product_id=$2) AND ($3::text IS NULL OR d.status=$3) ORDER BY d.created_at,d.id`,
    [query.q ?? null, query.product_id ?? null, query.status ?? null])).rows };
  });
}
