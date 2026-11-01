import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { money } from '../shared/validation.js';
import type { Database } from './db.js';
import { ApiError } from './errors.js';
import { audit, idempotent } from './idempotency.js';

const cashInput = z.object({
  direction: z.enum(['in', 'out']), method: z.enum(['cash', 'bank']), amount: money.refine(value => value > 0),
  category: z.enum(['other_income', 'expense']), note: z.string().trim().max(4000).optional(),
}).strict().superRefine((value, context) => {
  if ((value.category === 'other_income') !== (value.direction === 'in'))
    context.addIssue({ code: 'custom', message: 'Cash direction does not match category' });
});

const reportQuery = z.object({
  from: z.iso.date(), to: z.iso.date(),
}).strict().refine(value => value.from <= value.to, 'from must be on or before to');

function safeMoney(value: string | number | bigint): number {
  const amount = BigInt(value);
  if (amount < BigInt(Number.MIN_SAFE_INTEGER) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Aggregate exceeds safe VND range');
  return Number(amount);
}

export function registerCashReports(app: FastifyInstance, pool: Database) {
  app.get('/api/cash', async () => {
    const result = await pool.query(`WITH entries AS (
        SELECT c.id,c.created_at,c.direction,c.method,c.amount,c.category,c.note,
          coalesce(p.sale_id,p.purchase_id,c.return_id,c.purchase_return_id) AS reference_id
        FROM cash_entries c LEFT JOIN payments p ON p.id=c.payment_id
      ), balances AS (
        SELECT coalesce(sum(amount::numeric*CASE WHEN method='cash' AND direction='in' THEN 1 WHEN method='cash' THEN -1 ELSE 0 END),0)::text cash_balance,
          coalesce(sum(amount::numeric*CASE WHEN method='bank' AND direction='in' THEN 1 WHEN method='bank' THEN -1 ELSE 0 END),0)::text bank_balance
        FROM cash_entries
      ) SELECT entries.*,balances.cash_balance,balances.bank_balance FROM balances LEFT JOIN entries ON true ORDER BY entries.created_at,entries.id`);
    const values = result.rows[0];
    return { items: result.rows.filter(row => row.id !== null).map(({ cash_balance, bank_balance, ...entry }) => entry),
      cash_balance: safeMoney(values.cash_balance), bank_balance: safeMoney(values.bank_balance) };
  });

  app.post('/api/cash', async (request, reply) => {
    const input = cashInput.parse(request.body);
    const result = await idempotent(pool, request.headers['idempotency-key'], request.user!.id,
      'POST /cash', request.body, 201, async client => {
        const entry = (await client.query(`INSERT INTO cash_entries(direction,method,amount,category,note,actor)
          VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,created_at,direction,method,amount,category,note`,
        [input.direction,input.method,input.amount,input.category,input.note ?? '',request.user!.id])).rows[0];
        await audit(client, request.user!.id, 'create', 'cash_entry', entry.id, {
          direction: input.direction, method: input.method, amount: input.amount, category: input.category,
        });
        return { ...entry, reference_id: null };
      });
    return reply.code(result.statusCode).send(result.body);
  });

  app.get('/api/reports', async request => {
    const { from, to } = reportQuery.parse(request.query);
    const params = [from,to];
    const range = `created_at >= (($1::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
      AND created_at < ((($2::date + 1)::timestamp) AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const [sales, collections, expenses, debt, inventory, daily, bestSellers] = await Promise.all([
      pool.query(`SELECT coalesce((SELECT sum(total::numeric) FROM sales WHERE ${range}),0)::text AS revenue,
        coalesce((SELECT sum(cost::numeric) FROM sales WHERE ${range}),0)::text AS cost,
        coalesce((SELECT sum(total::numeric) FROM returns WHERE ${range}),0)::text AS returned_revenue,
        coalesce((SELECT sum(cost::numeric) FROM returns WHERE ${range}),0)::text AS returned_cost`, params),
      pool.query(`SELECT coalesce((SELECT sum(amount::numeric) FROM payments WHERE sale_id IS NOT NULL AND ${range}),0)::text AS received,
        coalesce((SELECT sum(refund::numeric) FROM returns WHERE ${range}),0)::text AS refunded`, params),
      pool.query(`SELECT coalesce(sum(amount::numeric),0)::text AS amount FROM cash_entries WHERE category='expense' AND ${range}`, params),
      pool.query(`SELECT
        coalesce((SELECT sum((s.total::numeric - coalesce(r.total,0) - coalesce(p.amount,0) + coalesce(r.refund,0)))
          FROM sales s LEFT JOIN LATERAL (SELECT sum(total::numeric) total,sum(refund::numeric) refund FROM returns WHERE sale_id=s.id AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) r ON true
          LEFT JOIN LATERAL (SELECT sum(amount::numeric) amount FROM payments WHERE sale_id=s.id AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) p ON true
          WHERE s.created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')),0)::text AS customer_debt,
        coalesce((SELECT sum((p.total::numeric - coalesce(r.total,0) - coalesce(pay.amount,0) + coalesce(r.refund,0)))
          FROM purchases p LEFT JOIN LATERAL (SELECT sum(total::numeric) total,sum(refund::numeric) refund FROM purchase_returns WHERE purchase_id=p.id AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) r ON true
          LEFT JOIN LATERAL (SELECT sum(amount::numeric) amount FROM payments WHERE purchase_id=p.id AND created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')) pay ON true
          WHERE p.created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')),0)::text AS supplier_debt`, [to]),
      pool.query(`SELECT coalesce((SELECT sum(cost::numeric) FROM devices WHERE status IN ('available','quarantine')),0)
          + coalesce((SELECT sum(remaining_quantity::numeric*unit_cost) FROM accessory_lots),0)::numeric AS stock_value,
        (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'sku',sku,'name',name,'kind',kind,'stock_quantity',stock_quantity,'min_stock',min_stock) ORDER BY name,id),'[]'::jsonb)
          FROM (SELECT p.id,p.sku,p.name,p.kind,p.min_stock,CASE WHEN p.kind='PHONE'
            THEN (SELECT count(*) FROM devices d WHERE d.product_id=p.id AND d.status='available')::bigint
            ELSE (SELECT coalesce(sum(l.remaining_quantity),0) FROM accessory_lots l WHERE l.product_id=p.id) END AS stock_quantity
            FROM products p) stock WHERE stock_quantity<=min_stock) AS low_stock`),
      pool.query(`WITH days AS (SELECT generate_series($1::date,$2::date,interval '1 day')::date AS report_day),
        activity AS (
          SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date report_day,sum(total::numeric) revenue,sum(cost::numeric) cost FROM sales WHERE ${range} GROUP BY 1
          UNION ALL
          SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date report_day,-sum(total::numeric),-sum(cost::numeric) FROM returns WHERE ${range} GROUP BY 1
        )
        SELECT to_char(days.report_day,'YYYY-MM-DD') AS date,
          coalesce(sum(activity.revenue),0)::text AS revenue,coalesce(sum(activity.cost),0)::text AS cost
        FROM days LEFT JOIN activity ON activity.report_day=days.report_day GROUP BY days.report_day ORDER BY days.report_day`, params),
      pool.query(`SELECT product_id,product_name,
          (sum(quantity::numeric)-coalesce(sum(returned_quantity::numeric),0))::text AS quantity,
          (sum(total::numeric)-coalesce(sum(returned_value::numeric),0))::text AS revenue
        FROM (
          SELECT l.product_id,l.product_name,l.quantity,l.total,0::numeric AS returned_quantity,0::numeric AS returned_value
            FROM sale_lines l JOIN sales s ON s.id=l.sale_id WHERE s.${range}
          UNION ALL
          SELECT l.product_id,l.product_name,0,l.quantity*0,rl.quantity,rl.value
            FROM return_lines rl JOIN returns r ON r.id=rl.return_id JOIN sale_lines l ON l.id=rl.sale_line_id WHERE r.${range}
        ) movements GROUP BY product_id,product_name HAVING sum(quantity::numeric)-coalesce(sum(returned_quantity::numeric),0)>0
        ORDER BY sum(total::numeric)-coalesce(sum(returned_value::numeric),0) DESC,product_name,product_id LIMIT 10`, params),
    ]);
    const headline = sales.rows[0];
    const revenue = safeMoney(BigInt(headline.revenue) - BigInt(headline.returned_revenue));
    const cost = safeMoney(BigInt(headline.cost) - BigInt(headline.returned_cost));
    const collection = collections.rows[0];
    const dailyRows = daily.rows.map(row => {
      const dayRevenue = safeMoney(row.revenue as string), dayCost = safeMoney(row.cost as string);
      return { date: row.date, revenue: dayRevenue, cost: dayCost, gross_profit: safeMoney(dayRevenue - dayCost) };
    });
    const inv = inventory.rows[0];
    return {
      revenue, cost, gross_profit: safeMoney(revenue - cost),
      collected: safeMoney(BigInt(collection.received) - BigInt(collection.refunded)),
      expenses: safeMoney(expenses.rows[0].amount as string),
      customer_debt: safeMoney(debt.rows[0].customer_debt as string), supplier_debt: safeMoney(debt.rows[0].supplier_debt as string),
      stock_value: safeMoney(inv.stock_value as string), low_stock: inv.low_stock,
      daily: dailyRows,
      best_sellers: bestSellers.rows.map(row => ({ product_id: row.product_id, product_name: row.product_name,
        quantity: safeMoney(row.quantity as string), revenue: safeMoney(row.revenue as string) })),
    };
  });
}
