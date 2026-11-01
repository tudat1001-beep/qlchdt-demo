export interface SaleLineAllocation {
  id: string;
  sale_line_id: string;
  lot_id: string;
  product_id: string;
  position: number;
  quantity: number;
  unit_cost: number;
  cost: number;
}

export interface SaleLine {
  id: string;
  sale_id: string;
  position: number;
  product_id: string;
  product_name: string;
  sku: string;
  kind: 'PHONE' | 'ACCESSORY';
  product_snapshot: Record<string, unknown>;
  device_id: string | null;
  imei: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  cost: number;
  returned_quantity: number;
  allocations?: SaleLineAllocation[];
}

export interface SalePayment {
  id: string;
  sale_id?: string;
  purchase_id?: string;
  reference_id: string;
  party_type: 'customer' | 'supplier';
  method: 'cash' | 'bank';
  amount: number;
  note: string;
  actor: string;
  created_at: string;
}

export type SaleStatus = 'posted' | 'partially_returned' | 'returned' | 'cancelled' | 'completed';

export interface SaleReturnAllocation {
  id: string;
  return_line_id: string;
  sale_line_id: string;
  sale_allocation_id: string;
  quantity: number;
  cost: number;
}

export interface SaleReturnLine {
  id: string;
  return_id: string;
  sale_id: string;
  sale_line_id: string;
  product_id: string;
  position: number;
  quantity: number;
  value: number;
  cost: number;
  allocations?: SaleReturnAllocation[];
}

export interface SaleReturn {
  id: string;
  sale_id: string;
  kind: 'return' | 'cancel';
  reason: string;
  disposition: 'available' | 'quarantine';
  method: 'cash' | 'bank';
  total: number;
  cost: number;
  refund: number;
  debt_reduction: number;
  actor: string;
  created_at: string;
  lines: SaleReturnLine[];
}

export interface Sale {
  id: string;
  number: string;
  customer_id: string | null;
  customer_name: string;
  customer_snapshot: string | null;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  paid: number;
  debt: number;
  returned_total?: number;
  returned_cost?: number;
  refunded?: number;
  net_total?: number;
  net_cost?: number;
  paid_net?: number;
  note: string;
  status: SaleStatus;
  actor: string;
  created_at: string;
}

export interface SaleDetail extends Sale {
  lines: SaleLine[];
  payments: SalePayment[];
  returns: SaleReturn[];
}

export interface ReturnLineInput {
  sale_line_id: string;
  quantity: number;
}

export interface ReturnInputPayload {
  sale_id: string;
  reason: string;
  disposition: 'available' | 'quarantine';
  method: 'cash' | 'bank';
  lines: ReturnLineInput[];
}

export interface CancelSalePayload {
  reason: string;
  disposition: 'available' | 'quarantine';
  method: 'cash' | 'bank';
}

export interface SaleLineInput {
  product_id: string;
  device_id?: string;
  quantity: number;
  unit_price: number;
}

export interface SaleInputPayload {
  customer_id?: string | null;
  discount: number;
  note?: string;
  payments: { method: 'cash' | 'bank'; amount: number }[];
  lines: SaleLineInput[];
}

export interface PaymentInputPayload {
  party_type: 'customer' | 'supplier';
  reference_id: string;
  method: 'cash' | 'bank';
  amount: number;
  note?: string;
}
