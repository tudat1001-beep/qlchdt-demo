import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { multiplyVnd,partialReturnVnd,sumVnd } from '../shared/money.js';
import { uuid } from '../shared/validation.js';
import type { Database } from './db.js';
import { lockProducts,returnDetail,saleSelect } from './documents.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { cancelInput,returnInput } from './transaction-validation.js';

type Line={id:string;product_id:string;device_id:string|null;quantity:number;total:number;cost:number;returned_quantity:number};
type Allocation={id:string;sale_line_id:string;lot_id:string;quantity:number;unit_cost:number;returned_quantity:number};
type Device={id:string;status:string;purchase_line_id:string;cost:number};
type Lot={id:string;purchase_line_id:string};

export function registerReturns(app:FastifyInstance,pool:Database) {
  for (const cancel of [false,true]) app.post(cancel?'/api/sales/:id/cancel':'/api/returns',async (request,reply) => {
    const returning=cancel?undefined:returnInput.parse(request.body);
    const input=returning??cancelInput.parse(request.body);
    const saleId=returning?.sale_id??z.object({id:uuid}).parse(request.params).id;
    const requested=returning?.lines;
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,
      cancel?`POST /sales/${saleId}/cancel`:'POST /returns',request.body,201,async client => {
        const originalLines=(await client.query<Line>('SELECT * FROM sale_lines WHERE sale_id=$1 ORDER BY position',[saleId])).rows;
        await lockProducts(client,originalLines.map(line => line.product_id));
        const original=(await client.query('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[saleId])).rows[0];
        if (!original) throw new ApiError(404,'NOT_FOUND','Không tìm thấy phiếu bán');
        const document=(await client.query(`${saleSelect} WHERE s.id=$1`,[saleId])).rows[0];
        if (['returned','cancelled'].includes(document.status)) throw new ApiError(422,'ALREADY_RETURNED','Phiếu bán đã được trả hết hoặc hủy');
        const lines=(await client.query<Line>(`SELECT l.*,(SELECT coalesce(sum(quantity),0)::bigint FROM return_lines WHERE sale_line_id=l.id) AS returned_quantity
          FROM sale_lines l WHERE sale_id=$1 ORDER BY position`,[saleId])).rows;
        const requests=requested??lines.filter(line => line.returned_quantity<line.quantity)
          .map(line => ({sale_line_id:line.id,quantity:line.quantity-line.returned_quantity}));
        const byId=new Map(lines.map(line => [line.id,line]));
        const selected=requests.map(item => {
          const line=byId.get(item.sale_line_id);
          if (!line) throw new ApiError(422,'INVALID_RETURN_LINE','Dòng trả không thuộc phiếu bán');
          if (item.quantity>line.quantity-line.returned_quantity) throw new ApiError(422,'RETURN_QUANTITY','Số lượng trả vượt phần chưa trả');
          return {line,quantity:item.quantity,value:partialReturnVnd(line.total,line.quantity,line.returned_quantity,item.quantity)};
        });
        const devices=new Map((await client.query<Device>('SELECT * FROM devices WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
          [selected.flatMap(item => item.line.device_id?[item.line.device_id]:[])])).rows.map(device => [device.id,device]));
        if ((await client.query("SELECT id FROM warranties WHERE device_id=ANY($1::uuid[]) AND status IN ('received','processing')",
          [selected.flatMap(item=>item.line.device_id?[item.line.device_id]:[])])).rowCount)
          throw new ApiError(422,'ACTIVE_WARRANTY','Không thể trả thiết bị khi hồ sơ bảo hành còn hoạt động');
        const allocations=(await client.query<Allocation>(`SELECT a.*,(SELECT coalesce(sum(quantity),0)::bigint FROM return_allocations WHERE sale_allocation_id=a.id) AS returned_quantity
          FROM sale_allocations a JOIN sale_lines l ON l.id=a.sale_line_id WHERE l.sale_id=$1 ORDER BY l.position,a.position`,[saleId])).rows;
        const lots=new Map((await client.query<Lot>('SELECT * FROM accessory_lots WHERE id=ANY($1::uuid[]) ORDER BY created_at,id FOR UPDATE',
          [allocations.filter(allocation => selected.some(item => item.line.id===allocation.sale_line_id)).map(allocation => allocation.lot_id)])).rows.map(lot => [lot.id,lot]));
        const plans=selected.map(item => {
          const device=item.line.device_id?devices.get(item.line.device_id):undefined;
          if (item.line.device_id && (!device || device.status!=='sold')) throw new ApiError(422,'INVALID_DEVICE_STATE','Thiết bị không ở trạng thái đã bán');
          let remaining=item.quantity;
          const restored:{allocation:Allocation;quantity:number;cost:number}[]=[];
          if (!device) for (const allocation of allocations) {
            if (allocation.sale_line_id!==item.line.id || !remaining) continue;
            const quantity=Math.min(remaining,allocation.quantity-allocation.returned_quantity);
            if (quantity) restored.push({allocation,quantity,cost:multiplyVnd(allocation.unit_cost,quantity)});
            remaining-=quantity;
          }
          if (!device && remaining) throw new ApiError(422,'INVALID_ALLOCATION','Không đủ phân bổ giá vốn gốc để trả');
          return {...item,device,restored,cost:device?item.line.cost:sumVnd(restored.map(item => item.cost))};
        });
        const total=sumVnd(plans.map(plan => plan.value));
        const cost=sumVnd(plans.map(plan => plan.cost));
        const debtReduction=Math.min(total,document.debt);
        const refund=total-debtReduction;
        const saved=(await client.query(`INSERT INTO returns(sale_id,kind,reason,disposition,method,total,cost,refund,debt_reduction,actor)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[saleId,cancel?'cancel':'return',input.reason,input.disposition,input.method,total,cost,refund,debtReduction,request.user!.id])).rows[0];
        for (const [position,plan] of plans.entries()) {
          const line=(await client.query(`INSERT INTO return_lines(return_id,sale_id,sale_line_id,product_id,position,quantity,value,cost)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[saved.id,saleId,plan.line.id,plan.line.product_id,position,plan.quantity,plan.value,plan.cost])).rows[0];
          if (plan.device) {
            const updated=await client.query("UPDATE devices SET status=$2 WHERE id=$1 AND status='sold'",[plan.device.id,input.disposition]);
            if (updated.rowCount!==1) throw new ApiError(422,'INVALID_DEVICE_STATE','Thiết bị không ở trạng thái đã bán');
            await client.query(`INSERT INTO stock_movements(product_id,purchase_line_id,sale_line_id,return_line_id,device_id,quantity,cost,note,actor)
              VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8)`,[plan.line.product_id,plan.device.purchase_line_id,plan.line.id,line.id,plan.device.id,plan.cost,input.reason,request.user!.id]);
          } else for (const restored of plan.restored) {
            const lot=lots.get(restored.allocation.lot_id)!;
            const updated=await client.query('UPDATE accessory_lots SET remaining_quantity=remaining_quantity+$2 WHERE id=$1 AND remaining_quantity::bigint+$2<=quantity',[lot.id,restored.quantity]);
            if (updated.rowCount!==1) throw new ApiError(422,'INVALID_LOT_STATE','Số lượng lô trả vượt lượng nhập gốc');
            await client.query('INSERT INTO return_allocations(return_line_id,sale_line_id,sale_allocation_id,quantity,cost) VALUES ($1,$2,$3,$4,$5)',
              [line.id,plan.line.id,restored.allocation.id,restored.quantity,restored.cost]);
            await client.query(`INSERT INTO stock_movements(product_id,purchase_line_id,sale_line_id,return_line_id,lot_id,quantity,cost,note,actor)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[plan.line.product_id,lot.purchase_line_id,plan.line.id,line.id,lot.id,restored.quantity,restored.cost,input.reason,request.user!.id]);
          }
        }
        if (refund) await client.query(`INSERT INTO cash_entries(return_id,direction,method,amount,category,note,actor)
          VALUES ($1,'out',$2,$3,'sale_refund',$4,$5)`,[saved.id,input.method,refund,input.reason,request.user!.id]);
        await audit(client,request.user!.id,cancel?'cancel':'post','return',saved.id,{sale_id:saleId,total,cost,refund,debt_reduction:debtReduction});
        return returnDetail(client,saved.id);
      });
    return reply.code(result.statusCode).send(result.body);
  });
}
