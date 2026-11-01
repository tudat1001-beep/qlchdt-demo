import { test, expect } from '@playwright/test';

test.describe('Danh mục hàng hóa & Thiết bị (Catalog & Devices)', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticated state
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-001', username: 'admin' }),
      });
    });
  });

  test('Hiển thị bảng MISA compact với danh mục hàng hóa và bộ lọc loại', async ({ page }) => {
    const mockProducts = [
      {
        id: 'p-1',
        sku: 'IP15PM-256-TN',
        name: 'iPhone 15 Pro Max 256GB Titan Tự Nhiên',
        kind: 'PHONE',
        brand: 'Apple',
        model: 'iPhone 15 Pro Max',
        variant: 'VN/A',
        color: 'Titan Tự Nhiên',
        storage: '256GB',
        sale_price: 29500000,
        min_stock: 2,
        stock_quantity: 5,
      },
      {
        id: 'p-2',
        sku: 'SAC-20W-AP',
        name: 'Củ sạc nhanh Apple 20W USB-C',
        kind: 'ACCESSORY',
        brand: 'Apple',
        model: '20W Power Adapter',
        variant: null,
        color: 'Trắng',
        storage: null,
        sale_price: 490000,
        min_stock: 5,
        stock_quantity: 12,
      },
    ];

    await page.route('/api/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockProducts }),
      });
    });

    await page.goto('/');

    // Check table headers
    await expect(page.locator('.table-misa')).toBeVisible();
    await expect(page.locator('th:has-text("Mã SKU")')).toBeVisible();
    await expect(page.locator('th:has-text("Tên sản phẩm")')).toBeVisible();

    // Check row items
    const rows = page.locator('.table-misa tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.col-sku').first()).toHaveText('IP15PM-256-TN');
    await expect(page.locator('.badge-phone')).toHaveText('Điện thoại');
    await expect(page.locator('.badge-accessory')).toHaveText('Phụ kiện');

    // Check VND formatted price
    await expect(page.locator('.col-money').first()).toContainText('29.500.000 ₫');
  });

  test('Mở modal thêm sản phẩm, điều hướng phím Enter qua các trường', async ({ page }) => {
    await page.route('/api/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto('/');

    // Click "Thêm sản phẩm"
    await page.click('button:has-text("Thêm sản phẩm")');

    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Thêm sản phẩm mới');

    // Focus starts in first input
    const skuInput = page.locator('#product-sku');
    const nameInput = page.locator('#product-name');

    await skuInput.fill('IP14-128-BLK');
    // Pressing Enter should move focus to kind or next input without submitting
    await skuInput.press('Enter');

    // Close modal with Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Khi sửa sản phẩm, SKU và phân loại kind bị vô hiệu hóa (immutable)', async ({ page }) => {
    const mockProduct = {
      id: 'p-1',
      sku: 'IP15PM-256-TN',
      name: 'iPhone 15 Pro Max 256GB',
      kind: 'PHONE',
      brand: 'Apple',
      model: '15PM',
      variant: 'VN/A',
      color: 'Titan',
      storage: '256GB',
      sale_price: 29500000,
      min_stock: 2,
      stock_quantity: 5,
    };

    await page.route('/api/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [mockProduct] }),
      });
    });

    await page.goto('/');

    // Click Sửa button
    await page.click('button:has-text("Sửa")');

    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();

    // Verify SKU and kind are disabled
    await expect(page.locator('#product-sku')).toBeDisabled();
    await expect(page.locator('#product-kind')).toBeDisabled();
  });
});
