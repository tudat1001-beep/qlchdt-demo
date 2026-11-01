export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  debt: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  debt: number;
}

export interface CreatePartyInput {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
}

export interface UpdatePartyInput {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
}

export interface CustomerSaleSummary {
  id: string;
  number: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  created_at: string;
}

export interface PartyPaymentSummary {
  id: string;
  reference_id: string;
  method: 'cash' | 'bank';
  amount: number;
  note?: string;
  created_at: string;
}

export interface CustomerWarrantySummary {
  id: string;
  device_id: string;
  imei?: string;
  status: string;
  issue: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  sales?: CustomerSaleSummary[];
  payments?: PartyPaymentSummary[];
  warranties?: CustomerWarrantySummary[];
}

export interface SupplierPurchaseSummary {
  id: string;
  number: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  created_at: string;
}

export interface SupplierDetail extends Supplier {
  purchases?: SupplierPurchaseSummary[];
  payments?: PartyPaymentSummary[];
}
