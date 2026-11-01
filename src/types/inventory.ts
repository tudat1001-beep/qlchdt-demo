export interface Purchase {
  id: string;
  number: string;
  supplier_id: string;
  supplier_name: string;
  extra_cost: number;
  total: number;
  paid: number;
  debt: number;
  note: string;
  status: 'posted';
  actor: string;
  created_at: string;
}

export interface PurchaseLineDevice {
  id: string;
  imei: string;
  product_id: string;
  purchase_line_id: string;
  condition: 'NEW' | 'USED';
  cosmetic: string;
  battery: number | null;
  defects: string;
  included_accessories: string;
  cost: number;
  sale_price: number;
  status?: string;
}

export interface PurchaseLineLot {
  id: string;
  purchase_line_id: string;
  product_id: string;
  quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  created_at: string;
}

export interface PurchaseLine {
  id: string;
  purchase_id: string;
  position: number;
  product_id: string;
  product_name: string;
  sku: string;
  kind: 'PHONE' | 'ACCESSORY';
  product_snapshot: Record<string, unknown>;
  quantity: number;
  unit_cost: number;
  extra_cost: number;
  cost: number;
  devices?: PurchaseLineDevice[];
  lots?: PurchaseLineLot[];
}

export interface PurchasePayment {
  id: string;
  purchase_id?: string;
  sale_id?: string;
  reference_id: string;
  party_type: 'supplier' | 'customer';
  method: 'cash' | 'bank';
  amount: number;
  note: string;
  actor: string;
  created_at: string;
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[];
  payments: PurchasePayment[];
  returns: unknown[];
}

export interface DeviceInput {
  imei: string;
  condition: 'NEW' | 'USED';
  cosmetic?: string;
  battery?: number;
  defects?: string;
  included_accessories?: string;
  sale_price?: number;
}

export interface PurchaseLineInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
  devices?: DeviceInput[];
}

export interface PurchaseInputPayload {
  supplier_id: string;
  extra_cost: number;
  note?: string;
  payments: { method: 'cash' | 'bank'; amount: number }[];
  lines: PurchaseLineInput[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  purchase_line_id: string;
  sale_line_id?: string | null;
  device_id?: string | null;
  lot_id?: string | null;
  quantity: number;
  cost: number;
  product_name: string;
  imei?: string | null;
  reference_type: string;
  reference_id: string;
  note: string;
  actor: string;
  created_at: string;
}
