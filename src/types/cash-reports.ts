export interface CashEntry {
  id: string;
  created_at: string;
  direction: 'in' | 'out';
  method: 'cash' | 'bank';
  amount: number;
  category: 'other_income' | 'expense' | 'sale' | 'sale_return' | 'purchase' | 'purchase_return' | 'customer_debt' | 'supplier_debt' | string;
  note: string;
  reference_id: string | null;
}

export interface CashResponse {
  items: CashEntry[];
  cash_balance: number;
  bank_balance: number;
}

export interface CreateCashEntryInput {
  direction: 'in' | 'out';
  method: 'cash' | 'bank';
  amount: number;
  category: 'other_income' | 'expense';
  note?: string;
}

export interface LowStockItem {
  id: string;
  sku: string;
  name: string;
  kind: 'PHONE' | 'ACCESSORY';
  stock_quantity: number;
  min_stock: number;
}

export interface DailyReportRow {
  date: string;
  revenue: number;
  cost: number;
  gross_profit: number;
}

export interface BestSellerItem {
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
}

export interface ReportsResponse {
  revenue: number;
  cost: number;
  gross_profit: number;
  collected: number;
  expenses: number;
  customer_debt: number;
  supplier_debt: number;
  stock_value: number;
  low_stock: LowStockItem[];
  daily: DailyReportRow[];
  best_sellers: BestSellerItem[];
}
