export type WarrantyStatus = 'received' | 'processing' | 'completed' | 'cancelled';

export interface Warranty {
  id: string;
  device_id: string;
  imei?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  sale_id?: string | null;
  issue: string;
  resolution: string;
  status: WarrantyStatus;
  actor: string;
  created_at: string;
  updated_at: string;
}

export interface WarrantyCreateInputPayload {
  device_id: string;
  customer_id?: string;
  issue: string;
}

export interface WarrantyPatchPayload {
  status: WarrantyStatus;
  resolution?: string;
  release_to_stock?: boolean;
}
