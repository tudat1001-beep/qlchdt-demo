import { z } from 'zod';

export const uuid = z.uuid().transform(value => value.toLowerCase());
export const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const text = z.string().trim().max(500);
export const productFields = z.object({
  sku: z.string().trim().min(1).max(100), name: z.string().trim().min(1).max(200),
  kind: z.enum(['PHONE', 'ACCESSORY']), brand: text.optional(), model: text.optional(),
  variant: text.optional(), color: text.optional(), storage: text.optional(),
  sale_price: money, min_stock: z.number().int().min(0).max(2147483647).optional(),
}).strict();
export const productPatch = productFields.omit({ sku: true, kind: true }).partial()
  .refine(value => Object.keys(value).length > 0, 'Provide at least one editable field');
export const partyFields = z.object({
  name: z.string().trim().min(1).max(200), phone: z.string().trim().max(50).optional(),
  address: text.optional(), note: z.string().trim().max(4000).optional(),
}).strict();
export const partyPatch = partyFields.partial().refine(value => Object.keys(value).length > 0);
export const searchQuery = z.object({ q: z.string().max(200).optional() }).strict();
export type ProductInput = z.infer<typeof productFields>;
export type PartyInput = z.infer<typeof partyFields>;
