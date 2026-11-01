import { z } from 'zod';
import { money, uuid } from '../shared/validation.js';

export const quantity = z.number().int().min(1).max(2147483647);
export const paymentInput = z.object({ method: z.enum(['cash','bank']), amount: money.refine(value => value>0) }).strict();
export const note = z.string().trim().max(4000).optional();
export const purchaseInput = z.object({
  supplier_id: uuid, extra_cost: money.default(0), note,
  payments: z.array(paymentInput).max(20),
  lines: z.array(z.object({
    product_id: uuid, quantity, unit_cost: money,
    devices: z.array(z.object({
      imei: z.string().regex(/^\d{15}$/), condition: z.enum(['NEW','USED']),
      cosmetic: z.string().trim().max(500).optional(), battery: z.number().int().min(0).max(100).optional(),
      defects: z.string().trim().max(4000).optional(), included_accessories: z.string().trim().max(4000).optional(), sale_price: money.optional(),
    }).strict()).max(500).optional(),
  }).strict()).min(1).max(200),
}).strict().superRefine((value, context) => {
  const devices = value.lines.flatMap(line => line.devices ?? []);
  if (devices.length>500) context.addIssue({ code:'custom', message:'Tối đa 500 thiết bị mỗi phiếu' });
  if (new Set(devices.map(device => device.imei)).size!==devices.length) context.addIssue({ code:'custom', message:'IMEI bị lặp trong phiếu nhập' });
});
export type PurchaseInput = z.infer<typeof purchaseInput>;

export const saleInput = z.object({
  customer_id:uuid.nullable().optional(),discount:money.default(0),note,
  payments:z.array(paymentInput).max(20),
  lines:z.array(z.object({product_id:uuid,device_id:uuid.optional(),quantity,unit_price:money}).strict()).min(1).max(200),
}).strict();
export const collectionInput = z.object({party_type:z.enum(['customer','supplier']),reference_id:uuid,
  method:z.enum(['cash','bank']),amount:money.refine(value => value>0),note}).strict();
