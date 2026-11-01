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
  note: string;
  status: 'completed' | 'cancelled';
  actor: string;
  created_at: string;
}

export interface SaleDetail extends Sale {
  lines: SaleLine[];
  payments: SalePayment[];
  returns: unknown[];
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
