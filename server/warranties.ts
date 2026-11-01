import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { uuid } from '../shared/validation.js';
import { lockProducts } from './documents.js';
import type { Database } from './db.js';
import { transaction } from './db.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { warrantyCreateInput,warrantyPatchInput } from './transaction-validation.js';

export function registerWarranties(app:FastifyInstance,pool:Database) {
  app.get('/api/warranties',async request=>{
    const {q}=z.object({q:z.string().max(200).optional()}).strict().parse(request.query);
    return {items:(await pool.query(`SELECT w.*,d.imei,c.name AS customer_name FROM warranties w JOIN devices d ON d.id=w.device_id
      LEFT JOIN customers c ON c.id=w.customer_id WHERE ($1::text IS NULL OR concat_ws(' ',d.imei,c.name,w.issue,w.resolution) ILIKE '%'||$1||'%')
      ORDER BY w.created_at DESC,w.id`,[q??null])).rows};
  });
  app.post('/api/warranties',async(request,reply)=>{
    const input=warrantyCreateInput.parse(request.body);
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,'POST /warranties',request.body,201,async client=>{
      const source=(await client.query('SELECT product_id FROM devices WHERE id=$1',[input.device_id])).rows[0];
      if(!source) throw new ApiError(404,'NOT_FOUND','Không tìm thấy thiết bị');
      await lockProducts(client,[source.product_id]);
      const device=(await client.query('SELECT * FROM devices WHERE id=$1 FOR UPDATE',[input.device_id])).rows[0];
      if(!device) throw new ApiError(404,'NOT_FOUND','Không tìm thấy thiết bị');
      if((await client.query("SELECT id FROM warranties WHERE device_id=$1 AND status IN ('received','processing')",[device.id])).rowCount)
        throw new ApiError(409,'ACTIVE_WARRANTY','Thiết bị đã có hồ sơ bảo hành đang xử lý');
      if(!['available','sold','quarantine'].includes(device.status)) throw new ApiError(422,'INVALID_WARRANTY_DEVICE','Thiết bị không đủ điều kiện bảo hành');
      let saleId:string|null=null; let customerId:string|null=input.customer_id??null;
      if(device.status==='sold') {
        const sale=(await client.query(`SELECT s.id,s.customer_id FROM sale_lines l JOIN sales s ON s.id=l.sale_id
          WHERE l.device_id=$1 AND l.quantity>(SELECT coalesce(sum(quantity),0) FROM return_lines WHERE sale_line_id=l.id)
          ORDER BY s.created_at DESC,s.id LIMIT 1`,[device.id])).rows[0];
        if(!sale) throw new ApiError(422,'INVALID_WARRANTY_OWNER','Không xác định được chủ sở hữu hiện tại');
        saleId=sale.id;
        if(customerId && customerId!==sale.customer_id) throw new ApiError(422,'INVALID_WARRANTY_OWNER','Khách hàng không thuộc lần bán hiện tại');
        customerId=sale.customer_id;
      } else if(device.status==='available') {
        if(input.customer_id && !(await client.query('SELECT id FROM customers WHERE id=$1',[input.customer_id])).rowCount)
          throw new ApiError(404,'NOT_FOUND','Không tìm thấy khách hàng');
        await client.query("UPDATE devices SET status='quarantine' WHERE id=$1 AND status='available'",[device.id]);
      }
      const warranty=(await client.query(`INSERT INTO warranties(device_id,customer_id,sale_id,issue,status,actor)
        VALUES($1,$2,$3,$4,'received',$5) RETURNING *`,[device.id,customerId,saleId,input.issue,request.user!.id])).rows[0];
      await audit(client,request.user!.id,'create','warranty',warranty.id,{device_id:device.id,customer_id:customerId,sale_id:saleId,status:'received'});
      return warranty;
    });
    return reply.code(result.statusCode).send(result.body);
  });
  app.patch('/api/warranties/:id',async(request,reply)=>{
    const {id}=z.object({id:uuid}).parse(request.params); const input=warrantyPatchInput.parse(request.body);
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,`PATCH /warranties/${id}`,request.body,200,async client=>{
      const source=(await client.query('SELECT device_id FROM warranties WHERE id=$1',[id])).rows[0];
      if(!source) throw new ApiError(404,'NOT_FOUND','Không tìm thấy hồ sơ bảo hành');
      const product=(await client.query('SELECT product_id FROM devices WHERE id=$1',[source.device_id])).rows[0];
      await lockProducts(client,[product.product_id]);
      const warranty=(await client.query('SELECT * FROM warranties WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!warranty) throw new ApiError(404,'NOT_FOUND','Không tìm thấy hồ sơ bảo hành');
      const device=(await client.query('SELECT * FROM devices WHERE id=$1 FOR UPDATE',[warranty.device_id])).rows[0];
      const valid=(warranty.status==='received'&&input.status==='processing')||(warranty.status==='processing'&&['completed','cancelled'].includes(input.status));
      if(!valid) throw new ApiError(422,'INVALID_WARRANTY_TRANSITION','Trạng thái bảo hành không hợp lệ');
      if(input.release_to_stock && (!['completed','cancelled'].includes(input.status)||device.status!=='quarantine'||warranty.sale_id))
        throw new ApiError(422,'INVALID_STOCK_RELEASE','Chỉ được trả thiết bị cửa hàng đang cách ly về kho ở bước kết thúc');
      if(warranty.sale_id && input.release_to_stock) throw new ApiError(422,'CUSTOMER_DEVICE_RELEASE','Không thể đưa thiết bị khách hàng trở lại kho');
      if(input.release_to_stock) await client.query("UPDATE devices SET status='available' WHERE id=$1 AND status='quarantine'",[device.id]);
      const updated=(await client.query(`UPDATE warranties SET status=$2,resolution=$3,updated_at=now() WHERE id=$1 RETURNING *`,
        [id,input.status,input.resolution??warranty.resolution])).rows[0];
      await audit(client,request.user!.id,'transition','warranty',id,{from:warranty.status,to:input.status,resolution:input.resolution??warranty.resolution,release_to_stock:input.release_to_stock??false});
      return updated;
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
