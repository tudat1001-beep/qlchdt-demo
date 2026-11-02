import { describe, expect, it } from 'vitest';
import { demoFetch } from '../src/lib/demo-api';

describe('GitHub Pages demo API', () => {
  it('serves sample catalog, customers, sales and report data', async () => {
    const catalog = await demoFetch<{ items: Array<{ id: string }> }>('/products', 'GET');
    const customers = await demoFetch<{ items: Array<{ id: string }> }>('/customers', 'GET');
    const sales = await demoFetch<{ items: Array<{ id: string }> }>('/sales', 'GET');
    const report = await demoFetch<{ daily: unknown[]; low_stock: unknown[] }>('/reports?from=2020-01-01&to=2020-01-02', 'GET');

    expect(catalog.items.length).toBeGreaterThan(0);
    expect(customers.items.length).toBeGreaterThan(0);
    expect(sales.items.length).toBeGreaterThan(0);
    expect(report.daily).toHaveLength(2);
    expect(report.low_stock.length).toBeGreaterThan(0);
  });

  it('rejects all demo mutations without saving data', async () => {
    await expect(demoFetch('/sales', 'POST', { lines: [] })).rejects.toThrow('không được lưu');
    await expect(demoFetch('/products/demo-product-1', 'PATCH', { sale_price: 1 })).rejects.toThrow('không được lưu');
  });
});
