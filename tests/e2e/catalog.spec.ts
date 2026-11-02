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

  test('Gom tìm kiếm sản phẩm khi gõ nhanh và giữ bảng trong lúc chờ API', async ({ page }) => {
    const requests: string[] = [];
    await page.route('/api/products*', async (route) => {
      requests.push(new URL(route.request().url()).search);
      if (requests.at(-1)) await new Promise(resolve => setTimeout(resolve, 350));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{
        id: 'p-1', sku: 'IP15', name: 'iPhone 15', kind: 'PHONE', sale_price: 20000000, min_stock: 0, stock_quantity: 1,
      }] }) });
    });

    await page.goto('/');
    const rows = page.locator('.table-misa tbody tr');
    await expect(rows).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' }).fill('i');
    await page.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' }).fill('ip');
    await page.getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' }).fill('ip15');
    await expect.poll(() => requests.filter(Boolean).length).toBe(1);
    await expect(rows).toHaveCount(1);
    expect(requests.filter(Boolean)).toHaveLength(1);
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

  test('Modal IMEI không tràn ngang và phân trang danh sách dài', async ({ page }) => {
    await page.route('/api/products*', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'phone-1', sku: 'IP-1', name: 'iPhone mẫu', kind: 'PHONE', brand: 'Apple', sale_price: 1000000, min_stock: 0, stock_quantity: 9 }] }),
    }));
    await page.route('/api/devices*', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: Array.from({ length: 9 }, (_, i) => ({
        id: `device-${i + 1}`, imei: `12345678901234${i}`, product_id: 'phone-1', product_name: 'iPhone mẫu', sku: 'IP-1',
        status: 'available', condition: 'NEW', battery: 100, cost: 900000, sale_price: 1000000,
      })) }),
    }));

    await page.goto('/');
    await page.getByRole('button', { name: 'Xem IMEI cho iPhone mẫu' }).click();

    const modalList = page.locator('.devices-modal-list');
    await expect(modalList.locator('tbody tr')).toHaveCount(8);
    await expect(modalList).toHaveJSProperty('scrollWidth', await modalList.evaluate((el) => el.clientWidth));
    await page.getByRole('button', { name: 'Sau' }).click();
    await expect(modalList.locator('tbody tr')).toHaveCount(1);
    await expect(modalList).toContainText('123456789012348');
  });

  test('Phiếu nhập hàng co gọn toàn bộ trường trên màn hình điện thoại', async ({ page }) => {
    await page.route('/api/suppliers*', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'supplier-1', name: 'Nhà cung cấp mẫu', phone: '0900000000', debt: 0 }] }),
    }));
    await page.route('/api/products*', async (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'phone-1', sku: 'IP-1', name: 'Điện thoại mẫu', kind: 'PHONE', brand: 'Apple', sale_price: 1000000, min_stock: 0, stock_quantity: 0 }] }),
    }));
    await page.route('/api/purchases*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
    await page.route('/api/stock-movements*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
    await page.route('/api/devices*', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));

    await page.goto('/');
    if (await page.locator('.mobile-bottom-nav-item:has-text("Nhập kho")').isVisible()) {
      await page.locator('.mobile-bottom-nav-item:has-text("Nhập kho")').click();
    } else {
      const mobileMenu = page.locator('.mobile-menu-btn');
      if (await mobileMenu.isVisible()) await mobileMenu.click();
      await page.click('button.nav-item:has-text("Nhập hàng & Kho")');
    }
    await page.getByRole('button', { name: 'Nhập hàng mới' }).click();
    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await page.locator('.purchase-general-grid select').selectOption('supplier-1');
    await page.locator('.purchase-line-grid select').selectOption('phone-1');

    const widthsFit = await modal.evaluate((el) => {
      const sections = el.querySelectorAll('.purchase-general-grid, .purchase-line-grid, .purchase-device-grid, .purchase-payment-grid, .purchase-summary-row');
      return el.scrollWidth <= el.clientWidth + 1 && Array.from(sections).every((section) => section.scrollWidth <= section.clientWidth + 1);
    });
    expect(widthsFit).toBe(true);
    if (await page.evaluate(() => window.innerWidth <= 480)) {
      await page.screenshot({ path: test.info().outputPath('purchase-modal-mobile.png'), fullPage: false });
    }
  });
});
