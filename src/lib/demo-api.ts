const date = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const products = [
  { id: 'demo-product-1', sku: 'IP15PM-256', name: 'iPhone 15 Pro Max 256GB', kind: 'PHONE', brand: 'Apple', model: 'iPhone 15 Pro Max', variant: 'VN/A', color: 'Titan tự nhiên', storage: '256GB', sale_price: 29_500_000, min_stock: 1, stock_quantity: 2 },
  { id: 'demo-product-2', sku: 'IP13-128-USED', name: 'iPhone 13 128GB (đã qua sử dụng)', kind: 'PHONE', brand: 'Apple', model: 'iPhone 13', variant: 'VN/A', color: 'Đen', storage: '128GB', sale_price: 10_900_000, min_stock: 1, stock_quantity: 1 },
  { id: 'demo-product-3', sku: 'APP2-USB-C', name: 'AirPods Pro 2 USB-C', kind: 'ACCESSORY', brand: 'Apple', model: 'AirPods Pro 2', variant: 'USB-C', color: 'Trắng', storage: '', sale_price: 6_490_000, min_stock: 2, stock_quantity: 1 },
  { id: 'demo-product-4', sku: 'CASE-IP15', name: 'Ốp lưng trong iPhone 15', kind: 'ACCESSORY', brand: 'MobiCare', model: 'Clear Case', variant: '', color: 'Trong suốt', storage: '', sale_price: 290_000, min_stock: 3, stock_quantity: 1 },
];

const devices = [
  { id: 'demo-device-1', imei: '000000000000001', product_id: products[0].id, product_name: products[0].name, sku: products[0].sku, status: 'available', condition: 'NEW', cosmetic: 'Mới 100%', battery: 100, defects: '', included_accessories: 'Hộp, cáp sạc', cost: 25_000_000, sale_price: 29_500_000 },
  { id: 'demo-device-2', imei: '000000000000002', product_id: products[0].id, product_name: products[0].name, sku: products[0].sku, status: 'available', condition: 'NEW', cosmetic: 'Mới 100%', battery: 100, defects: '', included_accessories: 'Hộp, cáp sạc', cost: 25_200_000, sale_price: 29_500_000 },
  { id: 'demo-device-3', imei: '000000000000003', product_id: products[1].id, product_name: products[1].name, sku: products[1].sku, status: 'available', condition: 'USED', cosmetic: 'Đẹp 98%', battery: 88, defects: '', included_accessories: 'Hộp, cáp sạc', cost: 8_500_000, sale_price: 10_900_000 },
  { id: 'demo-device-4', imei: '000000000000004', product_id: products[0].id, product_name: products[0].name, sku: products[0].sku, status: 'sold', condition: 'NEW', cosmetic: 'Mới 100%', battery: 100, defects: '', included_accessories: 'Hộp, cáp sạc', cost: 25_000_000, sale_price: 29_500_000 },
];

const customers = [
  { id: 'demo-customer-1', name: 'Nguyễn Minh Anh (Mẫu)', phone: '0900000001', address: 'Quận 1, TP. Hồ Chí Minh', note: 'Khách hàng demo', debt: 0 },
  { id: 'demo-customer-2', name: 'Trần Quốc Bảo (Mẫu)', phone: '0900000002', address: 'Quận Bình Thạnh, TP. Hồ Chí Minh', note: '', debt: 2_000_000 },
  { id: 'demo-customer-3', name: 'Lê Ngọc Hà (Mẫu)', phone: '0900000003', address: 'TP. Thủ Đức, TP. Hồ Chí Minh', note: '', debt: 0 },
];

const suppliers = [
  { id: 'demo-supplier-1', name: 'Công ty Thiết bị Sao Mai (Mẫu)', phone: '0900000011', address: 'Quận 10, TP. Hồ Chí Minh', note: 'Nhà cung cấp demo', debt: 3_000_000 },
  { id: 'demo-supplier-2', name: 'Phụ kiện Minh Tâm (Mẫu)', phone: '0900000012', address: 'Quận 5, TP. Hồ Chí Minh', note: '', debt: 0 },
];

const sales = [
  { id: 'demo-sale-1', number: 'BH-DEMO-001', customer_id: customers[0].id, customer_name: customers[0].name, customer_snapshot: customers[0].name, subtotal: 29_790_000, discount: 290_000, total: 29_500_000, cost: 25_290_000, paid: 29_500_000, debt: 0, returned_total: 0, refunded: 0, net_total: 29_500_000, paid_net: 29_500_000, note: 'Giao dịch mẫu', status: 'posted', actor: 'demo', created_at: date(1) },
  { id: 'demo-sale-2', number: 'BH-DEMO-002', customer_id: customers[1].id, customer_name: customers[1].name, customer_snapshot: customers[1].name, subtotal: 12_900_000, discount: 0, total: 12_900_000, cost: 10_000_000, paid: 10_900_000, debt: 2_000_000, returned_total: 0, refunded: 0, net_total: 12_900_000, paid_net: 10_900_000, note: 'Còn công nợ mẫu', status: 'posted', actor: 'demo', created_at: date(3) },
];

const saleDetails = [
  { ...sales[0], lines: [{ id: 'demo-sale-line-1', sale_id: sales[0].id, position: 1, product_id: products[0].id, product_name: products[0].name, sku: products[0].sku, kind: 'PHONE', product_snapshot: products[0], device_id: devices[3].id, imei: devices[3].imei, quantity: 1, unit_price: 29_500_000, discount: 0, total: 29_500_000, cost: 25_000_000, returned_quantity: 0 }], payments: [{ id: 'demo-pay-1', sale_id: sales[0].id, reference_id: sales[0].id, party_type: 'customer', method: 'bank', amount: 29_500_000, note: 'Thanh toán mẫu', actor: 'demo', created_at: sales[0].created_at }], returns: [] },
  { ...sales[1], lines: [{ id: 'demo-sale-line-2', sale_id: sales[1].id, position: 1, product_id: products[1].id, product_name: products[1].name, sku: products[1].sku, kind: 'PHONE', product_snapshot: products[1], device_id: 'demo-device-sold-2', imei: '000000000000005', quantity: 1, unit_price: 10_900_000, discount: 0, total: 10_900_000, cost: 8_500_000, returned_quantity: 0 }], payments: [{ id: 'demo-pay-2', sale_id: sales[1].id, reference_id: sales[1].id, party_type: 'customer', method: 'cash', amount: 10_900_000, note: 'Thanh toán mẫu', actor: 'demo', created_at: sales[1].created_at }], returns: [] },
];

const purchases = [
  { id: 'demo-purchase-1', number: 'NH-DEMO-001', supplier_id: suppliers[0].id, supplier_name: suppliers[0].name, extra_cost: 200_000, total: 50_400_000, paid: 47_400_000, debt: 3_000_000, returned_total: 0, refunded: 0, net_total: 50_400_000, paid_net: 47_400_000, note: 'Phiếu nhập mẫu', status: 'posted', actor: 'demo', created_at: date(4) },
  { id: 'demo-purchase-2', number: 'NH-DEMO-002', supplier_id: suppliers[1].id, supplier_name: suppliers[1].name, extra_cost: 0, total: 3_000_000, paid: 3_000_000, debt: 0, returned_total: 0, refunded: 0, net_total: 3_000_000, paid_net: 3_000_000, note: 'Nhập phụ kiện mẫu', status: 'posted', actor: 'demo', created_at: date(6) },
];

const purchaseDetails = purchases.map((purchase, index) => ({
  ...purchase,
  lines: index === 0 ? [{ id: 'demo-purchase-line-1', purchase_id: purchase.id, position: 1, product_id: products[0].id, product_name: products[0].name, sku: products[0].sku, kind: 'PHONE', product_snapshot: products[0], quantity: 2, unit_cost: 25_000_000, extra_cost: 200_000, cost: 50_200_000, devices: devices.slice(0, 2), lots: [] }] : [{ id: 'demo-purchase-line-2', purchase_id: purchase.id, position: 1, product_id: products[2].id, product_name: products[2].name, sku: products[2].sku, kind: 'ACCESSORY', product_snapshot: products[2], quantity: 1, unit_cost: 3_000_000, extra_cost: 0, cost: 3_000_000, devices: [], lots: [{ id: 'demo-lot-1', purchase_line_id: 'demo-purchase-line-2', product_id: products[2].id, quantity: 1, remaining_quantity: 1, unit_cost: 3_000_000, created_at: purchase.created_at }] }],
  payments: [{ id: `demo-purchase-pay-${index}`, purchase_id: purchase.id, reference_id: purchase.id, party_type: 'supplier', method: 'bank', amount: purchase.paid, note: 'Thanh toán mẫu', actor: 'demo', created_at: purchase.created_at }],
  returns: [],
}));

const warranties = [
  { id: 'demo-warranty-1', device_id: devices[3].id, imei: devices[3].imei, customer_id: customers[0].id, customer_name: customers[0].name, sale_id: sales[0].id, issue: 'Kiểm tra loa thoại (mẫu)', resolution: '', status: 'received', actor: 'demo', created_at: date(1), updated_at: date(1) },
  { id: 'demo-warranty-2', device_id: devices[2].id, imei: devices[2].imei, customer_id: customers[2].id, customer_name: customers[2].name, sale_id: 'demo-sale-older', issue: 'Hỗ trợ cập nhật phần mềm (mẫu)', resolution: 'Đã hướng dẫn khách', status: 'completed', actor: 'demo', created_at: date(10), updated_at: date(8) },
];

const movements = [
  { id: 'demo-movement-1', product_id: products[0].id, purchase_line_id: 'demo-purchase-line-1', device_id: devices[0].id, quantity: 1, cost: 25_000_000, product_name: products[0].name, imei: devices[0].imei, reference_type: 'purchase', reference_id: purchases[0].id, note: 'Nhập hàng mẫu', actor: 'demo', created_at: purchases[0].created_at },
  { id: 'demo-movement-2', product_id: products[0].id, purchase_line_id: 'demo-purchase-line-1', sale_line_id: 'demo-sale-line-1', device_id: devices[3].id, quantity: -1, cost: 25_000_000, product_name: products[0].name, imei: devices[3].imei, reference_type: 'sale', reference_id: sales[0].id, note: 'Bán hàng mẫu', actor: 'demo', created_at: sales[0].created_at },
];

const cashEntries = [
  { id: 'demo-cash-opening', created_at: date(30), direction: 'in', method: 'bank', amount: 30_000_000, category: 'other_income', note: 'Số dư đầu kỳ mẫu', reference_id: null },
  { id: 'demo-cash-1', created_at: date(1), direction: 'in', method: 'bank', amount: 29_500_000, category: 'sale', note: 'Thu bán hàng mẫu', reference_id: sales[0].id },
  { id: 'demo-cash-2', created_at: date(3), direction: 'in', method: 'cash', amount: 10_900_000, category: 'sale', note: 'Thu bán hàng mẫu', reference_id: sales[1].id },
  { id: 'demo-cash-3', created_at: date(4), direction: 'out', method: 'bank', amount: 47_400_000, category: 'purchase', note: 'Thanh toán nhập hàng mẫu', reference_id: purchases[0].id },
  { id: 'demo-cash-4', created_at: date(2), direction: 'out', method: 'cash', amount: 350_000, category: 'expense', note: 'Vật tư đóng gói (mẫu)', reference_id: null },
];

const demoUser = { id: 'demo-user', username: 'demo' };
const match = (record: Record<string, unknown>, query: string) =>
  !query || Object.values(record).some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase()));

function report(from?: string, to?: string) {
  const inRange = sales.filter(sale => {
    const day = sale.created_at.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });
  const revenue = inRange.reduce((sum, sale) => sum + sale.total, 0);
  const cost = inRange.reduce((sum, sale) => sum + sale.cost, 0);
  const days = from && to ? Math.max(1, Math.min(62, Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86_400_000) + 1)) : 1;
  const daily = Array.from({ length: days }, (_, i) => {
    const current = new Date(`${from || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + i);
    const day = current.toISOString().slice(0, 10);
    const daySales = inRange.filter(sale => sale.created_at.slice(0, 10) === day);
    const dayRevenue = daySales.reduce((sum, sale) => sum + sale.total, 0);
    const dayCost = daySales.reduce((sum, sale) => sum + sale.cost, 0);
    return { date: day, revenue: dayRevenue, cost: dayCost, gross_profit: dayRevenue - dayCost };
  });
  return {
    revenue, cost, gross_profit: revenue - cost,
    collected: inRange.reduce((sum, sale) => sum + sale.paid, 0),
    expenses: cashEntries.filter(entry => entry.category === 'expense').filter(entry => {
      const day = entry.created_at.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    }).reduce((sum, entry) => sum + entry.amount, 0),
    customer_debt: customers.reduce((sum, customer) => sum + customer.debt, 0),
    supplier_debt: suppliers.reduce((sum, supplier) => sum + supplier.debt, 0),
    stock_value: 61_850_000,
    low_stock: products.filter(product => product.stock_quantity <= product.min_stock).map(({ id, sku, name, kind, stock_quantity, min_stock }) => ({ id, sku, name, kind, stock_quantity, min_stock })),
    daily,
    best_sellers: [{ product_id: products[0].id, product_name: products[0].name, quantity: 1, revenue: 29_500_000 }],
  };
}

export async function demoFetch<T>(endpoint: string, method: string, body?: unknown): Promise<T> {
  const normalizedMethod = method.toUpperCase();
  const [path, query = ''] = endpoint.split('?');
  const params = new URLSearchParams(query);

  if (path === '/auth/me' && normalizedMethod === 'GET') return demoUser as T;
  if (path === '/auth/login' && normalizedMethod === 'POST') return demoUser as T;
  if (path === '/auth/logout' && normalizedMethod === 'POST') return { ok: true } as T;
  if (normalizedMethod !== 'GET') {
    throw new Error('Bản demo chỉ xem dữ liệu mẫu; thay đổi và giao dịch không được lưu.');
  }

  const q = (params.get('q') || '').trim();
  if (path === '/products') return { items: products.filter(item => (!params.has('kind') || item.kind === params.get('kind')) && match(item, q)) } as T;
  if (path === '/devices') return { items: devices.filter(item => (!params.has('status') || item.status === params.get('status')) && match(item, q)) } as T;
  if (path === '/customers') return { items: customers.filter(item => match(item, q)) } as T;
  if (path.startsWith('/customers/')) {
    const customer = customers.find(item => item.id === path.slice('/customers/'.length));
    if (!customer) throw new Error('Không tìm thấy khách hàng mẫu.');
    return { ...customer, sales: sales.filter(sale => sale.customer_id === customer.id), payments: [], warranties: warranties.filter(warranty => warranty.customer_id === customer.id) } as T;
  }
  if (path === '/suppliers') return { items: suppliers.filter(item => match(item, q)) } as T;
  if (path.startsWith('/suppliers/')) {
    const supplier = suppliers.find(item => item.id === path.slice('/suppliers/'.length));
    if (!supplier) throw new Error('Không tìm thấy nhà cung cấp mẫu.');
    return { ...supplier, purchases: purchases.filter(purchase => purchase.supplier_id === supplier.id), payments: [] } as T;
  }
  if (path === '/sales') return { items: sales } as T;
  if (path.startsWith('/sales/')) {
    const sale = saleDetails.find(item => item.id === path.slice('/sales/'.length));
    if (!sale) throw new Error('Không tìm thấy phiếu bán mẫu.');
    return sale as T;
  }
  if (path === '/purchases') return { items: purchases } as T;
  if (path.startsWith('/purchases/')) {
    const purchase = purchaseDetails.find(item => item.id === path.slice('/purchases/'.length));
    if (!purchase) throw new Error('Không tìm thấy phiếu nhập mẫu.');
    return purchase as T;
  }
  if (path === '/stock-movements') return { items: movements } as T;
  if (path === '/cash') return { items: [...cashEntries].sort((a, b) => b.created_at.localeCompare(a.created_at)), cash_balance: 10_550_000, bank_balance: 12_100_000 } as T;
  if (path === '/reports') return report(params.get('from') || undefined, params.get('to') || undefined) as T;
  if (path === '/warranties') return { items: warranties.filter(item => match(item, q)) } as T;

  throw new Error(`Chức năng demo chưa có dữ liệu cho ${path}${body ? '' : ''}.`);
}
