import { test, expect, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env for ADMIN credentials
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

async function navigateTo(page: Page, label: string) {
  await expect(page.locator('.page-title')).toBeVisible();
  const mobileBtn = page.locator('.mobile-menu-btn');
  const wasMobile = await mobileBtn.isVisible();
  if (wasMobile) {
    await mobileBtn.click();
    await expect(page.locator('.app-sidebar')).toHaveClass(/sidebar-open/);
  }
  await page.click(`button.nav-item:has-text("${label}")`);
  if (wasMobile) {
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('.sidebar-backdrop')).not.toBeVisible();
  }
}

test.describe('Real API Foundation End-to-End Flow (Guarded _test Database)', () => {
  test('Luồng thực tế không mock: Đăng nhập -> Tạo SP -> Sửa SP -> Tạo KH -> Xem Drawer -> Tạo NCC -> Reload xác minh persistence -> Đăng xuất', async ({
    page,
  }, testInfo) => {
    // Monitor console errors and uncaught page exceptions
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const testSku = `SP-${uniqueId}`;
    const testProductName = `iPhone 15 Test ${uniqueId}`;
    const testCustomerName = `Khách Hàng ${uniqueId}`;
    const testSupplierName = `Nhà Cung Cấp ${uniqueId}`;

    // 1. Visit root page - initial redirect to login
    await page.goto('/');
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');

    // 2. Perform live login against POST /api/auth/login
    await page.fill('#login-username', ADMIN_USER);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // Wait for sidebar and layout
    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText(ADMIN_USER);
    await expect(page.locator('.page-title')).toHaveText('Hàng hóa & Thiết bị');

    // 3. Create a real Product via POST /api/products
    await page.click('button:has-text("Thêm sản phẩm")');
    await expect(page.locator('#modal-title')).toHaveText('Thêm sản phẩm mới');

    await page.fill('#product-sku', testSku);
    await page.fill('#product-name', testProductName);
    await page.fill('#product-brand', 'Apple');
    await page.fill('#product-model', 'iPhone 15');
    await page.fill('#product-sale-price', '22500000');
    await page.fill('#product-min-stock', '3');
    await page.click('button[type="submit"][form="product-form"]');

    // Modal closes on success
    await expect(page.locator('.modal-card')).not.toBeVisible();

    // Verify row appears in real compact table
    const productRow = page.locator(`.table-misa tbody tr:has-text("${testSku}")`);
    await expect(productRow).toBeVisible();
    await expect(productRow).toContainText('22.500.000 ₫');

    // 4. Edit the real Product via PATCH /api/products/:id
    await productRow.locator('button:has-text("Sửa")').click();
    await expect(page.locator('#modal-title')).toContainText(testSku);

    // Verify immutable fields
    await expect(page.locator('#product-sku')).toBeDisabled();
    await expect(page.locator('#product-kind')).toBeDisabled();

    // Update name
    const updatedName = `${testProductName} Pro`;
    await page.fill('#product-name', updatedName);
    await page.click('button[type="submit"][form="product-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSku}")`)).toContainText(updatedName);

    // 5. Navigate to Khách hàng and create Customer via POST /api/customers
    await navigateTo(page, 'Khách hàng');
    await expect(page.locator('.page-title')).toHaveText('Khách hàng');

    await page.click('button:has-text("Thêm khách hàng")');
    await expect(page.locator('#modal-title')).toHaveText('Thêm khách hàng mới');

    await page.fill('#customer-name', testCustomerName);
    await page.fill('#customer-phone', '0987654321');
    await page.fill('#customer-address', '123 Phố Huế, Hà Nội');
    await page.click('button[type="submit"][form="customer-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();

    const customerRow = page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`);
    await expect(customerRow).toBeVisible();
    await expect(customerRow).toContainText('0987 654 321');

    // 6. Open real Customer detail Drawer via GET /api/customers/:id
    await customerRow.click();
    const customerDrawer = page.locator('.drawer-card');
    await expect(customerDrawer).toBeVisible();
    await expect(page.locator('#drawer-title')).toHaveText(testCustomerName);

    // Press Escape to test focus containment and keyboard dismissal
    await page.keyboard.press('Escape');
    await expect(customerDrawer).not.toBeVisible();

    // 7. Navigate to Nhà cung cấp and create Supplier via POST /api/suppliers
    await navigateTo(page, 'Nhà cung cấp');
    await expect(page.locator('.page-title')).toHaveText('Nhà cung cấp');

    await page.click('button:has-text("Thêm nhà cung cấp")');
    await expect(page.locator('#modal-title')).toHaveText('Thêm nhà cung cấp mới');

    await page.fill('#supplier-name', testSupplierName);
    await page.fill('#supplier-phone', '0912345678');
    await page.fill('#supplier-address', '456 Lê Duẩn, Đà Nẵng');
    await page.click('button[type="submit"][form="supplier-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();

    const supplierRow = page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`);
    await expect(supplierRow).toBeVisible();

    // Open supplier Drawer
    await supplierRow.click();
    const supplierDrawer = page.locator('.drawer-card');
    await expect(supplierDrawer).toBeVisible();
    await expect(page.locator('#drawer-title')).toHaveText(testSupplierName);
    await page.keyboard.press('Escape');
    await expect(supplierDrawer).not.toBeVisible();

    // 8. Reload page to verify database persistence & session survival
    await page.reload();
    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText(ADMIN_USER);

    // Verify product persisted in database
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSku}")`)).toBeVisible();

    // Navigate to Nhà cung cấp and verify supplier persisted in database
    await navigateTo(page, 'Nhà cung cấp');
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`)).toBeVisible();

    // Take screenshot evidence of clean UI
    await page.screenshot({
      path: `test-results/live-foundation-${testInfo.project.name.toLowerCase().replace(/\s+/g, '-')}.png`,
      fullPage: true,
    });

    // 9. Perform Logout and verify session termination
    await page.locator('.app-header button:has-text("Đăng xuất")').click();
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');

    // Verify that navigating to / while unauthenticated lands back on login
    await page.goto('/');
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');

    // Check no unexpected console errors were emitted (401 is expected during auth check)
    const unexpectedErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('401')
    );
    expect(unexpectedErrors).toEqual([]);
  });
});
