import type { FastifyInstance } from 'fastify';
import type { Database } from './db.js';
import { recordPayment,purchaseSelect,saleSelect } from './documents.js';
import { ApiError } from './errors.js';
import { audit,idempotent } from './idempotency.js';
import { collectionInput } from './transaction-validation.js';

export function registerPayments(app:FastifyInstance,pool:Database) {
  app.post('/api/payments',async (request,reply) => {
    const input=collectionInput.parse(request.body);
    const result=await idempotent(pool,request.headers['idempotency-key'],request.user!.id,'POST /payments',request.body,201,async client => {
      const supplier=input.party_type==='supplier';
      const document=(await client.query(`SELECT * FROM ${supplier?'purchases':'sales'} WHERE id=$1 FOR UPDATE`,[input.reference_id])).rows[0];
      if (!document) throw new ApiError(404,'NOT_FOUND','Không tìm thấy chứng từ công nợ');
      const balance=(await client.query(`${supplier?purchaseSelect:saleSelect} WHERE ${supplier?'p.id':'s.id'}=$1`,[document.id])).rows[0];
      const debt=balance.debt as number;
      if (input.amount>debt) throw new ApiError(422,'OVERPAYMENT','Số tiền vượt công nợ còn lại của chứng từ');
      const payment=await recordPayment(client,request.user!.id,document.id,input.party_type,input.method,input.amount,input.note??'',supplier?'supplier_payment':'customer_payment');
      await audit(client,request.user!.id,'collect','payment',payment.id,{reference_id:document.id,party_type:input.party_type,amount:input.amount});
      return payment;
    });
    return reply.code(result.statusCode).send(result.body);
  });
}
