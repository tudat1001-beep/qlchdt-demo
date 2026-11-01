import type { PoolClient } from 'pg';
import type { Database } from './db.js';
import { ApiError } from './errors.js';

export type Reader = Pick<Database,'query'> | Pick<PoolClient,'query'>;
export const purchaseSelect = `SELECT p.*,coalesce((SELECT sum(amount) FROM payments WHERE purchase_id=p.id),0)::money_vnd AS paid,
  (p.total-coalesce((SELECT sum(amount) FROM payments WHERE purchase_id=p.id),0))::money_vnd AS debt FROM purchases p`;
export const paymentSelect = `SELECT p.*,p.purchase_id AS reference_id,'supplier'::text AS party_type FROM payments p`;

export async function purchaseDetail(db: Reader, id: string) {
  const document = (await db.query(`${purchaseSelect} WHERE p.id=$1`,[id])).rows[0];
  if (!document) throw new ApiError(404,'NOT_FOUND','Không tìm thấy phiếu nhập');
  const lines = (await db.query('SELECT * FROM purchase_lines WHERE purchase_id=$1 ORDER BY position',[id])).rows;
  const devices = (await db.query('SELECT d.* FROM devices d JOIN purchase_lines l ON l.id=d.purchase_line_id WHERE l.purchase_id=$1 ORDER BY d.created_at,d.id',[id])).rows;
  const lots = (await db.query('SELECT a.* FROM accessory_lots a JOIN purchase_lines l ON l.id=a.purchase_line_id WHERE l.purchase_id=$1 ORDER BY a.created_at,a.id',[id])).rows;
  const payments = (await db.query(`${paymentSelect} WHERE p.purchase_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
  return { ...document, lines:lines.map(line => ({ ...line, devices:devices.filter(device => device.purchase_line_id===line.id),lots:lots.filter(lot => lot.purchase_line_id===line.id) })),payments,returns:[] };
}

export async function lockProducts(client: PoolClient, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  const rows = (await client.query<{ id:string; name:string; sku:string; kind:'PHONE'|'ACCESSORY'; sale_price:number }>(
    'SELECT * FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[unique])).rows;
  if (rows.length!==unique.length) throw new ApiError(404,'NOT_FOUND','Không tìm thấy sản phẩm trong phiếu');
  return new Map(rows.map(row => [row.id,row]));
}

export async function recordPayment(client: PoolClient, actor: string, purchaseId: string, method: 'cash'|'bank', amount: number, note: string, category: 'purchase'|'supplier_payment') {
  const payment = (await client.query('INSERT INTO payments(purchase_id,method,amount,note,actor) VALUES ($1,$2,$3,$4,$5) RETURNING *',[purchaseId,method,amount,note,actor])).rows[0];
  await client.query("INSERT INTO cash_entries(payment_id,direction,method,amount,category,note,actor) VALUES ($1,'out',$2,$3,$4,$5,$6)",[payment.id,method,amount,category,note,actor]);
  return { ...payment, reference_id:purchaseId,party_type:'supplier' };
}
