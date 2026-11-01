export interface Purchase {
  id: string;
  number: string;
  supplier_id: string;
  supplier_name: string;
  extra_cost: number;
  total: number;
  paid: number;
  debt: number;
  returned_total?: number;
  refunded?: number;
  net_total?: number;
  paid_net?: number;
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

export interface PurchaseReturnDevice {
  id: string;
  purchase_return_line_id: string;
  purchase_line_id: string;
  product_id: string;
  device_id: string;
  cost: number;
}

export interface PurchaseReturnAllocation {
  id: string;
  purchase_return_line_id: string;
  purchase_line_id: string;
  product_id: string;
  lot_id: string;
  quantity: number;
  unit_cost: number;
  cost: number;
}

export interface PurchaseReturnLine {
  id: string;
  purchase_return_id: string;
  purchase_id: string;
  purchase_line_id: string;
  product_id: string;
  position: number;
  quantity: number;
  value: number;
  devices?: PurchaseReturnDevice[];
  allocations?: PurchaseReturnAllocation[];
}

export interface PurchaseReturn {
  id: string;
  purchase_id: string;
  reason: string;
  method: 'cash' | 'bank';
  total: number;
  refund: number;
  debt_reduction: number;
  actor: string;
  created_at: string;
  lines: PurchaseReturnLine[];
}

export interface PurchaseDetail extends Purchase {
  lines: PurchaseLine[];
  payments: PurchasePayment[];
  returns: PurchaseReturn[];
}

export interface PurchaseReturnLineInput {
  purchase_line_id: string;
  quantity: number;
  device_ids?: string[];
}

export interface PurchaseReturnInputPayload {
  purchase_id: string;
  reason: string;
  method: 'cash' | 'bank';
  lines: PurchaseReturnLineInput[];
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
