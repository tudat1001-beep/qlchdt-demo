export type ProductKind = 'PHONE' | 'ACCESSORY';

export interface Product {
  id: string;
  sku: string;
  name: string;
  kind: ProductKind;
  brand?: string | null;
  model?: string | null;
  variant?: string | null;
  color?: string | null;
  storage?: string | null;
  sale_price: number;
  min_stock?: number | null;
  stock_quantity?: number;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  kind: ProductKind;
  brand?: string;
  model?: string;
  variant?: string;
  color?: string;
  storage?: string;
  sale_price: number;
  min_stock?: number;
}

export interface UpdateProductInput {
  name?: string;
  brand?: string;
  model?: string;
  variant?: string;
  color?: string;
  storage?: string;
  sale_price?: number;
  min_stock?: number;
}

export type DeviceStatus = 'available' | 'sold' | 'quarantine' | 'returned_supplier';
export type DeviceCondition = 'NEW' | 'USED';

export interface Device {
  id: string;
  imei: string;
  product_id: string;
  product_name: string;
  sku: string;
  status: DeviceStatus;
  condition: DeviceCondition;
  cosmetic?: string | null;
  battery?: number | null;
  defects?: string | null;
  included_accessories?: string | null;
  cost?: number;
  sale_price?: number;
}
