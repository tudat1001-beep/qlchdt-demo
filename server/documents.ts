import type { PoolClient } from 'pg';
import type { Database } from './db.js';
import { ApiError } from './errors.js';

export type Reader = Pick<Database,'query'> | Pick<PoolClient,'query'>;
export const purchaseSelect = `SELECT p.*,x.paid::money_vnd AS paid,r.total::money_vnd AS returned_total,
  r.refund::money_vnd AS refunded,(p.total-r.total)::money_vnd AS net_total,(x.paid-r.refund)::money_vnd AS paid_net,
  (p.total-x.paid-r.reduction)::money_vnd AS debt FROM purchases p
  CROSS JOIN LATERAL (SELECT coalesce(sum(amount),0) AS paid FROM payments WHERE purchase_id=p.id) x
  CROSS JOIN LATERAL (SELECT coalesce(sum(total),0) AS total,coalesce(sum(refund),0) AS refund,
    coalesce(sum(debt_reduction),0) AS reduction FROM purchase_returns WHERE purchase_id=p.id) r`;
export const paymentSelect = `SELECT p.*,coalesce(p.purchase_id,p.sale_id) AS reference_id,
  CASE WHEN p.purchase_id IS NOT NULL THEN 'supplier' ELSE 'customer' END AS party_type FROM payments p`;
export const saleSelect = `SELECT s.id,s.number,s.customer_id,s.customer_name,s.customer_snapshot,s.subtotal,s.discount,
  s.total,s.cost,s.note,s.actor,s.created_at,p.paid::money_vnd AS paid,r.total::money_vnd AS returned_total,
  r.cost::money_vnd AS returned_cost,r.refund::money_vnd AS refunded,
  (s.total-r.total)::money_vnd AS net_total,(s.cost-r.cost)::money_vnd AS net_cost,
  (p.paid-r.refund)::money_vnd AS paid_net,(s.total-p.paid-r.reduction)::money_vnd AS debt,
  CASE WHEN r.cancelled THEN 'cancelled' WHEN NOT r.any_return THEN 'posted'
    WHEN NOT EXISTS (SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND l.quantity>
      (SELECT coalesce(sum(quantity),0) FROM return_lines WHERE sale_line_id=l.id)) THEN 'returned'
    ELSE 'partially_returned' END AS status
  FROM sales s CROSS JOIN LATERAL (SELECT coalesce(sum(amount),0) AS paid FROM payments WHERE sale_id=s.id) p
  CROSS JOIN LATERAL (SELECT coalesce(sum(total),0) AS total,coalesce(sum(cost),0) AS cost,
    coalesce(sum(refund),0) AS refund,coalesce(sum(debt_reduction),0) AS reduction,
    coalesce(bool_or(kind='cancel'),false) AS cancelled,count(*)>0 AS any_return FROM returns WHERE sale_id=s.id) r`;

export async function purchaseDetail(db: Reader, id: string) {
  const document = (await db.query(`${purchaseSelect} WHERE p.id=$1`,[id])).rows[0];
  if (!document) throw new ApiError(404,'NOT_FOUND','Không tìm thấy phiếu nhập');
  const lines = (await db.query('SELECT * FROM purchase_lines WHERE purchase_id=$1 ORDER BY position',[id])).rows;
  const devices = (await db.query('SELECT d.* FROM devices d JOIN purchase_lines l ON l.id=d.purchase_line_id WHERE l.purchase_id=$1 ORDER BY d.created_at,d.id',[id])).rows;
  const lots = (await db.query('SELECT a.* FROM accessory_lots a JOIN purchase_lines l ON l.id=a.purchase_line_id WHERE l.purchase_id=$1 ORDER BY a.created_at,a.id',[id])).rows;
  const payments = (await db.query(`${paymentSelect} WHERE p.purchase_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
  const returns=(await db.query('SELECT * FROM purchase_returns WHERE purchase_id=$1 ORDER BY created_at,id',[id])).rows;
  const returnLines=(await db.query('SELECT * FROM purchase_return_lines WHERE purchase_id=$1 ORDER BY position,id',[id])).rows;
  const returnDevices=(await db.query('SELECT * FROM purchase_return_devices WHERE purchase_line_id=ANY($1::uuid[])',[lines.map(line=>line.id)])).rows;
  const returnAllocations=(await db.query('SELECT * FROM purchase_return_allocations WHERE purchase_line_id=ANY($1::uuid[])',[lines.map(line=>line.id)])).rows;
  return { ...document, lines:lines.map(line => ({ ...line, devices:devices.filter(device => device.purchase_line_id===line.id),lots:lots.filter(lot => lot.purchase_line_id===line.id) })),payments,
    returns:returns.map(doc=>({...doc,lines:returnLines.filter(line=>line.purchase_return_id===doc.id).map(line=>({...line,
      devices:returnDevices.filter(device=>device.purchase_return_line_id===line.id),allocations:returnAllocations.filter(allocation=>allocation.purchase_return_line_id===line.id)}))})) };
}

export async function lockProducts(client: PoolClient, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const rows = (await client.query<{ id:string; name:string; sku:string; kind:'PHONE'|'ACCESSORY'; sale_price:number }>(
    'SELECT * FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[unique])).rows;
  if (rows.length!==unique.length) throw new ApiError(404,'NOT_FOUND','Không tìm thấy sản phẩm trong phiếu');
  return new Map(rows.map(row => [row.id,row]));
}

export async function recordPayment(client: PoolClient, actor: string, referenceId: string, partyType:'supplier'|'customer', method: 'cash'|'bank', amount: number, note: string, category: 'purchase'|'supplier_payment'|'sale'|'customer_payment') {
  const payment = (await client.query('INSERT INTO payments(purchase_id,sale_id,method,amount,note,actor) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [partyType==='supplier'?referenceId:null,partyType==='customer'?referenceId:null,method,amount,note,actor])).rows[0];
  await client.query('INSERT INTO cash_entries(payment_id,direction,method,amount,category,note,actor) VALUES ($1,$2,$3,$4,$5,$6,$7)',[payment.id,partyType==='supplier'?'out':'in',method,amount,category,note,actor]);
  return { ...payment, reference_id:referenceId,party_type:partyType };
}

export async function saleDetail(db:Reader,id:string) {
  const document=(await db.query(`${saleSelect} WHERE s.id=$1`,[id])).rows[0];
  if (!document) throw new ApiError(404,'NOT_FOUND','Không tìm thấy phiếu bán');
  const lines=(await db.query(`SELECT l.*,(SELECT coalesce(sum(quantity),0)::bigint FROM return_lines WHERE sale_line_id=l.id) AS returned_quantity
    FROM sale_lines l WHERE sale_id=$1 ORDER BY position`,[id])).rows;
  const allocations=(await db.query('SELECT a.* FROM sale_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=$1 ORDER BY l.position,a.position',[id])).rows;
  const payments=(await db.query(`${paymentSelect} WHERE p.sale_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
  const returns=(await db.query('SELECT * FROM returns WHERE sale_id=$1 ORDER BY created_at,id',[id])).rows;
  const returnLines=(await db.query('SELECT * FROM return_lines WHERE sale_id=$1 ORDER BY position,id',[id])).rows;
  return {...document,lines:lines.map(line => ({...line,allocations:allocations.filter(allocation => allocation.sale_line_id===line.id)})),payments,
    returns:returns.map(document => ({...document,lines:returnLines.filter(line => line.return_id===document.id)}))};
}

export async function returnDetail(db:Reader,id:string) {
  const document=(await db.query('SELECT * FROM returns WHERE id=$1',[id])).rows[0];
  const lines=(await db.query('SELECT * FROM return_lines WHERE return_id=$1 ORDER BY position',[id])).rows;
  const allocations=(await db.query(`SELECT a.* FROM return_allocations a JOIN return_lines l ON l.id=a.return_line_id
    WHERE l.return_id=$1 ORDER BY l.position,a.id`,[id])).rows;
  return {...document,lines:lines.map(line => ({...line,allocations:allocations.filter(allocation => allocation.return_line_id===line.id)}))};
}
