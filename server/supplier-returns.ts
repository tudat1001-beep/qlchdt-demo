import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { multiplyVnd,sumVnd } from '../shared/money.js';
import { uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { lockProducts,purchaseSelect } from './documents.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { purchaseReturnInput } from './transaction-validation.js';

type PurchaseLine={id:string;product_id:string;kind:string;quantity:number;returned_quantity:number};
type Device={id:string;purchase_line_id:string;product_id:string;status:string;cost:number};
type Lot={id:string;purchase_line_id:string;product_id:string;remaining_quantity:number;unit_cost:number};

export function registerSupplierReturns(app:FastifyInstance,pool:Database) {
  app.post('/api/purchase-returns',async(request,reply)=>{
    const input=purchaseReturnInput.parse(request.body);
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,'POST /purchase-returns',request.body,201,async client=>{
      const sourceLines=(await client.query<PurchaseLine>('SELECT * FROM purchase_lines WHERE purchase_id=$1 ORDER BY position',[input.purchase_id])).rows;
      const products=await lockProducts(client,sourceLines.map(line=>line.product_id));
      const purchase=(await client.query('SELECT id FROM purchases WHERE id=$1 FOR UPDATE',[input.purchase_id])).rows[0];
      if(!purchase) throw new ApiError(404,'NOT_FOUND','Không tìm thấy phiếu nhập');
      const lines=(await client.query<PurchaseLine>(`SELECT l.*,(SELECT coalesce(sum(quantity),0)::bigint FROM purchase_return_lines WHERE purchase_line_id=l.id) AS returned_quantity
        FROM purchase_lines l WHERE purchase_id=$1 ORDER BY position`,[input.purchase_id])).rows;
      const byId=new Map(lines.map(line=>[line.id,line]));
      const requested=input.lines.map(item=>{
        const line=byId.get(item.purchase_line_id);
        if(!line) throw new ApiError(422,'INVALID_RETURN_LINE','Dòng trả không thuộc phiếu nhập');
        if(item.quantity>line.quantity-line.returned_quantity) throw new ApiError(422,'RETURN_QUANTITY','Số lượng trả vượt hàng gốc còn lại');
        const product=products.get(line.product_id)!;
        if(product.kind==='PHONE'?item.device_ids?.length!==item.quantity:item.device_ids!==undefined)
          throw new ApiError(400,'INVALID_RETURN_DEVICES','Điện thoại cần đúng IMEI theo số lượng; phụ kiện không nhận IMEI');
        return {...item,line};
      });
      const devices=new Map((await client.query<Device>('SELECT * FROM devices WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
        [requested.flatMap(line=>line.device_ids??[])])).rows.map(device=>[device.id,device]));
      const selectedLots=(await client.query<Lot>(`SELECT a.* FROM accessory_lots a JOIN purchase_lines l ON l.id=a.purchase_line_id
        WHERE l.purchase_id=$1 AND a.remaining_quantity>0 ORDER BY a.created_at,a.id FOR UPDATE OF a`,[input.purchase_id])).rows;
      const plans=requested.map(item=>{
        if(products.get(item.line.product_id)!.kind==='PHONE') {
          const selected=item.device_ids!.map(id=>devices.get(id));
          if(selected.some(device=>!device||device.purchase_line_id!==item.line.id||device.status!=='available')) throw new ApiError(422,'STOCK_NOT_AVAILABLE','Thiết bị không còn thuộc tồn khả dụng của phiếu nhập');
          const selectedDevices=selected as Device[];
          return {...item,devices:selectedDevices,allocations:[],value:sumVnd(selectedDevices.map(device=>device.cost))};
        }
        let remaining=item.quantity;
        const allocations:{lot:Lot;quantity:number;cost:number}[]=[];
        for(const lot of selectedLots) if(lot.purchase_line_id===item.line.id&&remaining) {
          const quantity=Math.min(remaining,lot.remaining_quantity);
          allocations.push({lot,quantity,cost:multiplyVnd(lot.unit_cost,quantity)}); remaining-=quantity;
        }
        if(remaining) throw new ApiError(422,'STOCK_NOT_AVAILABLE','Số lượng lô gốc còn khả dụng không đủ');
        return {...item,devices:[],allocations,value:sumVnd(allocations.map(a=>a.cost))};
      });
      const total=sumVnd(plans.map(plan=>plan.value));
      const document=(await client.query(`${purchaseSelect} WHERE p.id=$1`,[input.purchase_id])).rows[0];
      const reduction=Math.min(total,document.debt); const refund=total-reduction;
      if(refund>document.paid-document.refunded) throw new ApiError(422,'REFUND_EXCEEDS_PAID','Hoàn tiền vượt tổng tiền đã trả NCC');
      const saved=(await client.query(`INSERT INTO purchase_returns(purchase_id,reason,method,total,refund,debt_reduction,actor)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[input.purchase_id,input.reason,input.method,total,refund,reduction,request.user!.id])).rows[0];
      for(const [position,plan] of plans.entries()) {
        const line=(await client.query(`INSERT INTO purchase_return_lines(purchase_return_id,purchase_id,purchase_line_id,product_id,position,quantity,value)
          VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[saved.id,input.purchase_id,plan.line.id,plan.line.product_id,position,plan.quantity,plan.value])).rows[0];
        if(plan.devices.length) for(const device of plan.devices) {
          await client.query('INSERT INTO purchase_return_devices(purchase_return_line_id,purchase_line_id,product_id,device_id,cost) VALUES($1,$2,$3,$4,$5)',[line.id,plan.line.id,plan.line.product_id,device.id,device.cost]);
          const updated=await client.query("UPDATE devices SET status='returned_supplier' WHERE id=$1 AND status='available'",[device.id]);
          if(updated.rowCount!==1) throw new ApiError(422,'STOCK_NOT_AVAILABLE','Thiết bị không còn khả dụng');
          await client.query(`INSERT INTO stock_movements(product_id,purchase_id,purchase_line_id,purchase_return_id,purchase_return_line_id,device_id,quantity,cost,note,actor)
            VALUES($1,$2,$3,$4,$5,$6,-1,$7,$8,$9)`,[plan.line.product_id,input.purchase_id,plan.line.id,saved.id,line.id,device.id,-device.cost,input.reason,request.user!.id]);
        } else for(const allocation of plan.allocations) {
          await client.query('INSERT INTO purchase_return_allocations(purchase_return_line_id,purchase_line_id,product_id,lot_id,quantity,unit_cost,cost) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [line.id,plan.line.id,plan.line.product_id,allocation.lot.id,allocation.quantity,allocation.lot.unit_cost,allocation.cost]);
          const updated=await client.query('UPDATE accessory_lots SET remaining_quantity=remaining_quantity-$2 WHERE id=$1 AND remaining_quantity>=$2',[allocation.lot.id,allocation.quantity]);
          if(updated.rowCount!==1) throw new ApiError(422,'STOCK_NOT_AVAILABLE','Số lượng lô đã thay đổi');
          await client.query(`INSERT INTO stock_movements(product_id,purchase_id,purchase_line_id,purchase_return_id,purchase_return_line_id,lot_id,quantity,cost,note,actor)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[plan.line.product_id,input.purchase_id,plan.line.id,saved.id,line.id,allocation.lot.id,-allocation.quantity,-allocation.cost,input.reason,request.user!.id]);
        }
      }
      if(refund) await client.query(`INSERT INTO cash_entries(purchase_return_id,direction,method,amount,category,note,actor)
        VALUES($1,'in',$2,$3,'purchase_refund',$4,$5)`,[saved.id,input.method,refund,input.reason,request.user!.id]);
      await audit(client,request.user!.id,'post','purchase_return',saved.id,{purchase_id:input.purchase_id,total,refund,debt_reduction:reduction});
      return (await client.query('SELECT * FROM purchase_returns WHERE id=$1',[saved.id])).rows[0];
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
