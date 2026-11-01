import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { allocateDiscount,multiplyVnd,sumVnd } from '../shared/money.js';
import { searchQuery,uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { lockProducts,recordPayment,saleDetail,saleSelect } from './documents.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { saleInput } from './transaction-validation.js';

type Device = {id:string;product_id:string;purchase_line_id:string|null;imei:string;status:string;cost:number};
type Lot = {id:string;product_id:string;purchase_line_id:string;remaining_quantity:number;unit_cost:number};

export function registerSales(app:FastifyInstance,pool:Database) {
  app.get('/api/sales',async request => {
    const {q}=searchQuery.parse(request.query);
    return {items:(await pool.query(`${saleSelect} WHERE ($1::text IS NULL OR concat_ws(' ',s.number,s.customer_name,s.note) ILIKE '%' || $1 || '%'
      OR EXISTS (SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND concat_ws(' ',l.imei,l.sku,l.product_name) ILIKE '%' || $1 || '%')) ORDER BY s.created_at DESC,s.id`,[q??null])).rows};
  });
  app.get('/api/sales/:id',async request => saleDetail(pool,z.object({id:uuid}).parse(request.params).id));
  app.post('/api/sales',async (request,reply) => {
    const input=saleInput.parse(request.body);
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,'POST /sales',request.body,201,async client => {
      const products=await lockProducts(client,input.lines.map(line => line.product_id));
      const deviceIds=input.lines.flatMap(line => line.device_id?[line.device_id]:[]);
      if (new Set(deviceIds).size!==deviceIds.length) throw new ApiError(400,'DUPLICATE_DEVICE','Một thiết bị chỉ được xuất hiện một lần trong phiếu bán');
      const accessoryIds=new Set<string>();
      for (const line of input.lines) {
        const product=products.get(line.product_id)!;
        if (product.kind==='PHONE' && (!line.device_id || line.quantity!==1) || product.kind==='ACCESSORY' && line.device_id)
          throw new ApiError(400,'INVALID_DEVICE_LINES','Điện thoại cần một IMEI và số lượng 1; phụ kiện không nhận thiết bị');
        if (product.kind==='ACCESSORY') {
          if (accessoryIds.has(line.product_id)) throw new ApiError(400,'DUPLICATE_ACCESSORY_LINE','Phụ kiện bị lặp; vui lòng gộp số lượng vào cùng một dòng');
          accessoryIds.add(line.product_id);
        }
      }
      const gross=input.lines.map(line => multiplyVnd(line.unit_price,line.quantity));
      const subtotal=sumVnd(gross);
      const discounts=allocateDiscount(input.discount,gross);
      const total=subtotal-input.discount;
      const paid=sumVnd(input.payments.map(payment => payment.amount));
      if (paid>total) throw new ApiError(422,'OVERPAYMENT','Thanh toán vượt tổng phiếu bán');
      if (paid<total && !input.customer_id) throw new ApiError(422,'CUSTOMER_REQUIRED','Bán chịu phải chọn khách hàng');
      const customer=input.customer_id?(await client.query('SELECT * FROM customers WHERE id=$1',[input.customer_id])).rows[0]:null;
      if (input.customer_id && !customer) throw new ApiError(404,'NOT_FOUND','Không tìm thấy khách hàng');
      const deviceRows=(await client.query<Device>('SELECT * FROM devices WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[deviceIds])).rows;
      const devices=new Map(deviceRows.map(device => [device.id,device]));
      if ((await client.query("SELECT id FROM warranties WHERE device_id=ANY($1::uuid[]) AND status IN ('received','processing')",[deviceIds])).rowCount)
        throw new ApiError(409,'ACTIVE_WARRANTY','Thiết bị đang có hồ sơ bảo hành');
      const lots=(await client.query<Lot>('SELECT * FROM accessory_lots WHERE product_id=ANY($1::uuid[]) AND remaining_quantity>0 ORDER BY created_at,id FOR UPDATE',[[...accessoryIds]])).rows;
      const plans=input.lines.map(line => {
        const device=line.device_id?devices.get(line.device_id):undefined;
        const allocations:{lot:Lot;quantity:number;cost:number}[]=[];
        if (line.device_id) {
          if (!device) throw new ApiError(404,'NOT_FOUND','Không tìm thấy thiết bị');
          if (device.product_id!==line.product_id) throw new ApiError(400,'DEVICE_PRODUCT_MISMATCH','IMEI không thuộc sản phẩm đã chọn');
          if (device.status!=='available') throw new ApiError(409,'OUT_OF_STOCK','Thiết bị không còn sẵn sàng để bán');
          if (!device.purchase_line_id) throw new ApiError(422,'MISSING_PROVENANCE','Thiết bị chưa có nguồn nhập hợp lệ');
        } else {
          let remaining=line.quantity;
          for (const lot of lots) {
            if (lot.product_id!==line.product_id || !remaining) continue;
            const quantity=Math.min(remaining,lot.remaining_quantity);
            allocations.push({lot,quantity,cost:multiplyVnd(lot.unit_cost,quantity)});
            remaining-=quantity;
          }
          if (remaining) throw new ApiError(409,'OUT_OF_STOCK','Số lượng phụ kiện vượt tồn kho');
        }
        return {line,device,allocations,cost:device?device.cost:sumVnd(allocations.map(allocation => allocation.cost))};
      });
      const cost=sumVnd(plans.map(plan => plan.cost));
      const document=(await client.query(`INSERT INTO sales(customer_id,customer_name,customer_snapshot,subtotal,discount,total,cost,note,actor)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[input.customer_id??null,customer?.name??'',customer?JSON.stringify(customer):null,subtotal,input.discount,total,cost,input.note??'',request.user!.id])).rows[0];
      for (const [position,plan] of plans.entries()) {
        const {line,device,allocations}=plan;
        const product=products.get(line.product_id)!;
        const saved=(await client.query(`INSERT INTO sale_lines(sale_id,position,product_id,product_name,sku,kind,product_snapshot,device_id,imei,quantity,unit_price,discount,total,cost)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,[document.id,position,product.id,product.name,product.sku,product.kind,JSON.stringify(product),device?.id??null,device?.imei??null,line.quantity,line.unit_price,discounts[position],gross[position]-discounts[position],plan.cost])).rows[0];
        if (device) {
          const updated=await client.query("UPDATE devices SET status='sold' WHERE id=$1 AND status='available'",[device.id]);
          if (updated.rowCount!==1) throw new ApiError(409,'OUT_OF_STOCK','Thiết bị không còn sẵn sàng để bán');
          await client.query('INSERT INTO stock_movements(product_id,purchase_line_id,sale_line_id,device_id,quantity,cost,note,actor) VALUES ($1,$2,$3,$4,-1,$5,$6,$7)',[product.id,device.purchase_line_id,saved.id,device.id,-device.cost,input.note??'',request.user!.id]);
        } else for (const [allocationPosition,allocation] of allocations.entries()) {
          const updated=await client.query('UPDATE accessory_lots SET remaining_quantity=remaining_quantity-$2 WHERE id=$1 AND remaining_quantity>=$2',[allocation.lot.id,allocation.quantity]);
          if (updated.rowCount!==1) throw new ApiError(409,'OUT_OF_STOCK','Số lượng phụ kiện vượt tồn kho');
          await client.query('INSERT INTO sale_allocations(sale_line_id,lot_id,product_id,position,quantity,unit_cost,cost) VALUES ($1,$2,$3,$4,$5,$6,$7)',[saved.id,allocation.lot.id,product.id,allocationPosition,allocation.quantity,allocation.lot.unit_cost,allocation.cost]);
          await client.query('INSERT INTO stock_movements(product_id,purchase_line_id,sale_line_id,lot_id,quantity,cost,note,actor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[product.id,allocation.lot.purchase_line_id,saved.id,allocation.lot.id,-allocation.quantity,-allocation.cost,input.note??'',request.user!.id]);
        }
      }
      for (const payment of input.payments) await recordPayment(client,request.user!.id,document.id,'customer',payment.method,payment.amount,input.note??'','sale');
      await audit(client,request.user!.id,'post','sale',document.id,{total,cost,paid,line_count:plans.length});
      return saleDetail(client,document.id);
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
