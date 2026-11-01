import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { multiplyVnd,sumVnd } from '../shared/money.js';
import { uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { lockProducts,purchaseDetail,purchaseSelect,recordPayment } from './documents.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { purchaseInput } from './transaction-validation.js';

export function registerInventory(app: FastifyInstance,pool: Database) {
  app.get('/api/purchases',async () => ({items:(await pool.query(`${purchaseSelect} ORDER BY p.created_at DESC,p.id`)).rows}));
  app.get('/api/purchases/:id',async request => purchaseDetail(pool,z.object({id:uuid}).parse(request.params).id));
  app.post('/api/purchases',async (request,reply) => {
    const input = purchaseInput.parse(request.body);
    const result = await idempotent(pool,request.headers['idempotency-key'],request.user!.id,'POST /purchases',request.body,201,async client => {
      const products = await lockProducts(client,input.lines.map(line => line.product_id));
      const supplier = (await client.query('SELECT name FROM suppliers WHERE id=$1',[input.supplier_id])).rows[0];
      if (!supplier) throw new ApiError(404,'NOT_FOUND','Không tìm thấy nhà cung cấp');
      for (const line of input.lines) {
        if (products.get(line.product_id)!.kind==='PHONE' ? line.devices?.length!==line.quantity : line.devices!==undefined)
          throw new ApiError(400,'INVALID_DEVICE_LINES','Điện thoại phải đủ IMEI theo số lượng; phụ kiện không nhận danh sách thiết bị');
      }
      const total = sumVnd([...input.lines.map(line => multiplyVnd(line.unit_cost,line.quantity)),input.extra_cost]);
      const paid = sumVnd(input.payments.map(payment => payment.amount));
      if (paid>total) throw new ApiError(422,'OVERPAYMENT','Thanh toán vượt tổng phiếu nhập');
      const document = (await client.query('INSERT INTO purchases(supplier_id,supplier_name,extra_cost,total,note,actor) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
        [input.supplier_id,supplier.name,input.extra_cost,total,input.note??'',request.user!.id])).rows[0];
      const units = input.lines.reduce((sum,line) => sum+BigInt(line.quantity),0n);
      const baseExtra = BigInt(input.extra_cost)/units;
      let remainder = BigInt(input.extra_cost)%units;
      for (const [position,line] of input.lines.entries()) {
        const product = products.get(line.product_id)!;
        const extraUnits = remainder<BigInt(line.quantity)?remainder:BigInt(line.quantity);
        remainder-=extraUnits;
        const extraCost = Number(baseExtra*BigInt(line.quantity)+extraUnits);
        const cost = sumVnd([multiplyVnd(line.unit_cost,line.quantity),extraCost]);
        const saved = (await client.query(`INSERT INTO purchase_lines(purchase_id,position,product_id,product_name,sku,kind,product_snapshot,quantity,unit_cost,extra_cost,cost)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[document.id,position,product.id,product.name,product.sku,product.kind,JSON.stringify(product),line.quantity,line.unit_cost,extraCost,cost])).rows[0];
        if (product.kind==='PHONE') {
          for (const [index,device] of line.devices!.entries()) {
            const unitCost = sumVnd([line.unit_cost,Number(baseExtra),BigInt(index)<extraUnits?1:0]);
            const savedDevice = (await client.query(`INSERT INTO devices(imei,product_id,purchase_line_id,condition,cosmetic,battery,defects,included_accessories,cost,sale_price)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[device.imei,product.id,saved.id,device.condition,device.cosmetic??'',device.battery??null,device.defects??'',device.included_accessories??'',unitCost,device.sale_price??product.sale_price])).rows[0];
            await client.query('INSERT INTO stock_movements(product_id,purchase_line_id,device_id,quantity,cost,note,actor) VALUES ($1,$2,$3,1,$4,$5,$6)',[product.id,saved.id,savedDevice.id,unitCost,input.note??'',request.user!.id]);
          }
        } else {
          // Whole-dong extra costs form at most two FIFO lots, never per-unit rows.
          for (const [count,bonus] of [[Number(extraUnits),1],[line.quantity-Number(extraUnits),0]]) {
            if (!count) continue;
            const unitCost = sumVnd([line.unit_cost,Number(baseExtra),bonus]);
            const lot = (await client.query('INSERT INTO accessory_lots(purchase_line_id,product_id,quantity,remaining_quantity,unit_cost) VALUES ($1,$2,$3,$3,$4) RETURNING id',[saved.id,product.id,count,unitCost])).rows[0];
            await client.query('INSERT INTO stock_movements(product_id,purchase_line_id,lot_id,quantity,cost,note,actor) VALUES ($1,$2,$3,$4,$5,$6,$7)',[product.id,saved.id,lot.id,count,multiplyVnd(unitCost,count),input.note??'',request.user!.id]);
          }
        }
      }
      for (const payment of input.payments) await recordPayment(client,request.user!.id,document.id,'supplier',payment.method,payment.amount,input.note??'','purchase');
      await audit(client,request.user!.id,'post','purchase',document.id,{total,paid,line_count:input.lines.length});
      return purchaseDetail(client,document.id);
    });
    return reply.code(result.statusCode).send(result.body);
  });
  app.get('/api/stock-movements',async () => ({items:(await pool.query(`SELECT s.*,coalesce(sl.product_name,l.product_name) AS product_name,d.imei,
    CASE WHEN s.return_line_id IS NOT NULL THEN 'return' WHEN s.sale_line_id IS NOT NULL THEN 'sale' ELSE 'purchase' END AS reference_type,
    coalesce(rl.return_id,sl.sale_id,l.purchase_id) AS reference_id
    FROM stock_movements s JOIN purchase_lines l ON l.id=s.purchase_line_id LEFT JOIN devices d ON d.id=s.device_id
    LEFT JOIN sale_lines sl ON sl.id=s.sale_line_id LEFT JOIN return_lines rl ON rl.id=s.return_line_id ORDER BY s.created_at DESC,s.id`)).rows}));
}
