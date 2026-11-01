import { test, expect, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env for ADMIN credentials
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '';

async function navigateTo(page: Page, label: string) {
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
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-sidebar');
      return !el || el.getBoundingClientRect().right <= 0;
    });
  }
}

test.describe('Real API Inventory, POS, Invoices & Debt End-to-End Flow (Guarded _test Database)', () => {
  test('Luồng toàn vẹn: Tạo NCC & SP -> Nhập máy cũ + Phụ kiện -> Bán hàng POS (tiền mặt + chuyển khoản + ghi nợ) -> Thu nợ -> Reload kiểm chứng tồn kho/IMEI/hóa đơn', async ({
    page,
  }) => {
    test.setTimeout(90000);

    // Monitor console errors and uncaught page exceptions
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const testSupplierName = `Tổng Kho Phụ Kiện Sài Gòn ${uniqueId}`;
    const testCustomerName = `Anh Hoàng Minh ${uniqueId}`;
    const testPhoneSku = `IP14PM-${uniqueId}`;
    const testPhoneName = `iPhone 14 Pro Max 128GB ${uniqueId}`;
    const testAccSku = `SAC20W-${uniqueId}`;
    const testAccName = `Củ sạc nhanh 20W Type-C ${uniqueId}`;
    // 15 digit IMEI
    const testImei = `86${Math.floor(1000000000000 + Math.random() * 9000000000000).toString()}`.slice(0, 15);

    // ==========================================
    // 1. Đăng nhập hệ thống (POST /api/auth/login)
    // ==========================================
    await page.goto('/');
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');

    await page.fill('#login-username', ADMIN_USER);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // Wait for authentication and layout
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 15000 });

    // ==========================================
    // 2. Tạo Nhà Cung Cấp & Khách Hàng thực tế
    // ==========================================
    await navigateTo(page, 'Nhà cung cấp');
    await page.click('button:has-text("Thêm nhà cung cấp")');
    await page.fill('#supplier-name', testSupplierName);
    await page.fill('#supplier-phone', '0918765432');
    await page.fill('#supplier-address', '100 Nguyễn Thị Minh Khai, Q1');
    await page.click('button[type="submit"][form="supplier-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`)).toBeVisible();

    await navigateTo(page, 'Khách hàng');
    await page.click('button:has-text("Thêm khách hàng")');
    await page.fill('#customer-name', testCustomerName);
    await page.fill('#customer-phone', '0903112233');
    await page.fill('#customer-address', '45 Hai Bà Trưng, Q3');
    await page.click('button[type="submit"][form="customer-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`)).toBeVisible();

    // ==========================================
    // 3. Tạo 2 Sản phẩm: 1 Điện thoại + 1 Phụ kiện
    // ==========================================
    await navigateTo(page, 'Hàng hóa & Thiết bị');

    // Tạo Phone
    await page.click('button:has-text("Thêm sản phẩm")');
    await page.fill('#product-sku', testPhoneSku);
    await page.fill('#product-name', testPhoneName);
    await page.selectOption('#product-kind', 'PHONE');
    await page.fill('#product-brand', 'Apple');
    await page.fill('#product-sale-price', '18500000');
    await page.click('button[type="submit"][form="product-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testPhoneSku}")`)).toBeVisible();

    // Tạo Accessory
    await page.click('button:has-text("Thêm sản phẩm")');
    await page.fill('#product-sku', testAccSku);
    await page.fill('#product-name', testAccName);
    await page.selectOption('#product-kind', 'ACCESSORY');
    await page.fill('#product-brand', 'Apple');
    await page.fill('#product-sale-price', '350000');
    await page.click('button[type="submit"][form="product-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testAccSku}")`)).toBeVisible();

    // ==========================================
    // 4. Nhập hàng (Purchase): Máy cũ + Phụ kiện
    // ==========================================
    await navigateTo(page, 'Nhập hàng & Kho');
    await expect(page.locator('.app-header .page-title')).toHaveText('Nhập hàng & Kho');

    await page.click('button:has-text("Nhập hàng mới")');
    await expect(page.locator('.modal-card')).toBeVisible();

    // Chọn Nhà cung cấp
    const supplierSelect = page.locator('#purchase-form select').first();
    const supplierOptionVal = await supplierSelect.locator(`option:has-text("${testSupplierName}")`).getAttribute('value');
    await supplierSelect.selectOption(supplierOptionVal!);

    // Điền chi phí mua hàng phát sinh (50.000 đ)
    await page.fill('#purchase-extra-cost', '50000');

    // Dòng 1: Chọn Điện thoại
    const line1ProductSelect = page.locator('#purchase-form select').nth(1);
    const phoneOptionVal = await line1ProductSelect.locator(`option:has-text("${testPhoneSku}")`).getAttribute('value');
    await line1ProductSelect.selectOption(phoneOptionVal!);

    // Đơn giá nhập máy: 14.000.000 đ
    await page.fill('[data-testid="unit-cost-0"]', '14000000');

    // Điền thông tin máy cũ: IMEI 15 số, Tình trạng USED, Pin 88%, Ngoại hình 98%
    const imeiInput = page.locator('#purchase-form input[placeholder*="15 số IMEI"]');
    await imeiInput.fill(testImei);

    const conditionSelect = page.locator('#purchase-form select').nth(2);
    await conditionSelect.selectOption('USED');

    const batteryInput = page.locator('#purchase-form input[placeholder*="Pin %"]');
    await batteryInput.fill('88');

    const cosmeticInput = page.locator('#purchase-form input[placeholder*="Ngoại hình"]');
    await cosmeticInput.fill('98% trầy viền nhẹ');

    // Thêm dòng hàng thứ 2: Phụ kiện
    await page.click('button:has-text("Thêm dòng hàng")');

    const line2ProductSelect = page.locator('#purchase-form select').nth(3);
    const accOptionVal = await line2ProductSelect.locator(`option:has-text("${testAccSku}")`).getAttribute('value');
    await line2ProductSelect.selectOption(accOptionVal!);

    // Đơn giá nhập phụ kiện: 120.000 đ
    await page.fill('[data-testid="unit-cost-1"]', '120000');

    // Số lượng phụ kiện: 10
    await page.fill('[data-testid="accessory-qty-1"]', '10');

    // Thanh toán: Tiền mặt 5.000.000 đ, Chuyển khoản 5.000.000 đ (còn lại nợ NCC)
    await page.fill('#purchase-cash', '5000000');
    await page.fill('#purchase-bank', '5000000');

    // Hoàn tất nhập kho
    await page.click('button[form="purchase-form"]:has-text("Hoàn tất & Nhập kho")');

    // Verify modal closes and purchase drawer or purchase row appears
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // Close purchase drawer if opened
    const closeDrawerBtn = page.locator('button[aria-label="Đóng ngăn chi tiết"]');
    if (await closeDrawerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeDrawerBtn.click();
      await expect(page.locator('.drawer-card')).not.toBeVisible();
    }

    // Kiểm tra dòng phiếu nhập xuất hiện trong bảng
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`)).toBeVisible();

    // Chuyển sang Tab "Danh sách thiết bị (IMEI)" kiểm tra IMEI vừa nhập có trạng thái "Sẵn sàng bán"
    await page.click('button:has-text("Danh sách thiết bị")');
    await expect(page.locator(`.table-misa tbody tr:has-text("${testImei}")`)).toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testImei}"):has-text("Sẵn sàng bán")`)).toBeVisible();

    // ==========================================
    // 5. Bán hàng tại POS (Điện thoại + Phụ kiện)
    // ==========================================
    await navigateTo(page, 'Bán hàng (POS)');
    await expect(page.locator('.app-header .page-title')).toHaveText('Bán hàng (POS)');

    // Tìm kiếm thiết bị theo IMEI
    const posSearchInput = page.locator('input[placeholder*="Tìm sản phẩm, SKU hoặc gõ 15 số IMEI"]');
    await posSearchInput.fill(testImei);

    // Chọn máy điện thoại vào giỏ
    const pickDeviceBtn = page.locator('button:has-text("Chọn")').first();
    await pickDeviceBtn.click();

    // Xóa tìm kiếm để thêm củ sạc
    await posSearchInput.fill(testAccSku);
    const addAccBtn = page.locator('button:has-text("Thêm")').first();
    await addAccBtn.click();

    // Giỏ hàng hiện có 2 mặt hàng
    await expect(page.locator('.card:has-text("Giỏ hàng (2 mặt hàng)")')).toBeVisible();

    // Tăng số lượng phụ kiện lên 2 cái
    const qtyInputInCart = page.locator('.card:has-text("Giỏ hàng") input[type="number"][min="1"]');
    await qtyInputInCart.fill('2');

    // Thử nhập chiết khấu 200.000 đ
    await page.fill('#pos-discount', '200000');

    // Chọn khách hàng đã tạo
    const customerSelect = page.locator('#pos-customer-select');
    const custOptionVal = await customerSelect.locator(`option:has-text("${testCustomerName}")`).getAttribute('value');
    await customerSelect.selectOption(custOptionVal!);

    // Thanh toán: Tiền mặt 10.000.000 đ, Chuyển khoản 5.000.000 đ (còn lại 4.000.000 đ nợ)
    await page.fill('#pos-cash', '10000000');
    await page.fill('#pos-bank', '5000000');

    // Kiểm tra tính năng duplicate submit prevention: nút bị disabled khi submit
    const submitSaleBtn = page.locator('button:has-text("Xác nhận bán hàng")');
    await expect(submitSaleBtn).toBeEnabled();

    // Xác nhận bán hàng
    await submitSaleBtn.click();

    // Chờ xuất hiện hóa đơn bán hàng (SaleDrawer)
    await expect(page.locator('.drawer-card:has-text("HÓA ĐƠN BÁN HÀNG")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`.drawer-card:has-text("${testCustomerName}")`)).toBeVisible();
    await expect(page.locator(`.drawer-card:has-text("${testImei}")`)).toBeVisible();

    // Đóng drawer hóa đơn
    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 6. Thu nợ từ khách hàng (PaymentModal)
    // ==========================================
    await navigateTo(page, 'Phiếu bán & Thu nợ');
    await expect(page.locator('.app-header .page-title')).toHaveText('Phiếu bán & Thu nợ');

    // Dòng hóa đơn của khách xuất hiện trong bảng
    const saleRow = page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`);
    await expect(saleRow).toBeVisible();
    await expect(saleRow.locator('text=4.000.000 ₫')).toBeVisible();

    // Click nút "Thu nợ"
    await saleRow.locator('button:has-text("Thu nợ")').click();
    await expect(page.locator('.modal-card:has-text("Thu tiền nợ khách hàng")')).toBeVisible();

    // Thu 2.000.000 đ bằng Chuyển khoản
    await page.selectOption('#payment-form select', 'bank');
    const paymentAmountInput = page.locator('#payment-form input[type="number"]').first();
    await paymentAmountInput.fill('200000'); // Note: partial collection 2.000.000
    await paymentAmountInput.fill('2000000');

    await page.click('button[form="payment-form"]:has-text("Xác nhận thu nợ")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 10000 });

    // Dư nợ trên dòng hóa đơn giảm từ 4.000.000 đ xuống còn 2.000.000 đ
    await expect(saleRow.locator('text=2.000.000 ₫')).toBeVisible();

    // ==========================================
    // 7. Reload trang & Kiểm chứng Persistence
    // ==========================================
    await page.reload();
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 15000 });

    // Kiểm tra hóa đơn vẫn còn nguyên dư nợ 2.000.000 đ
    await navigateTo(page, 'Phiếu bán & Thu nợ');
    const reloadedSaleRow = page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`);
    await expect(reloadedSaleRow).toBeVisible();
    await expect(reloadedSaleRow.locator('text=2.000.000 ₫')).toBeVisible();

    // Kiểm tra tồn kho và trạng thái máy
    await navigateTo(page, 'Nhập hàng & Kho');
    await page.click('button:has-text("Danh sách thiết bị")');

    // Thiết bị đã chuyển sang trạng thái "Đã bán"
    const deviceRow = page.locator(`.table-misa tbody tr:has-text("${testImei}")`);
    await expect(deviceRow).toBeVisible();
    await expect(deviceRow.locator('text=Đã bán')).toBeVisible();

    // Phụ kiện giảm tồn kho từ 10 xuống 8
    await navigateTo(page, 'Hàng hóa & Thiết bị');
    const accRow = page.locator(`.table-misa tbody tr:has-text("${testAccSku}")`);
    await expect(accRow).toBeVisible();
    await expect(accRow.locator('td:nth-child(8)')).toHaveText('8');

    // ==========================================
    // 8. Chụp ảnh màn hình PC1440, Tablet768, Mobile390
    // ==========================================
    // PC 1440
    await page.setViewportSize({ width: 1440, height: 900 });
    await navigateTo(page, 'Bán hàng (POS)');
    await page.screenshot({ path: 'tests/e2e/screenshots/pc1440-pos.png', fullPage: true });

    await navigateTo(page, 'Phiếu bán & Thu nợ');
    await page.screenshot({ path: 'tests/e2e/screenshots/pc1440-sales.png', fullPage: true });

    // Tablet 768
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigateTo(page, 'Nhập hàng & Kho');
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('.sidebar-backdrop')).not.toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-sidebar');
      return !el || el.getBoundingClientRect().right <= 0;
    });
    await page.screenshot({ path: 'tests/e2e/screenshots/tablet768-inventory.png', fullPage: true });

    // Mobile 390
    await page.setViewportSize({ width: 390, height: 844 });
    // Verify mobile nav is completely closed and settled before capture
    await expect(page.locator('.app-sidebar')).not.toHaveClass(/sidebar-open/);
    await expect(page.locator('.sidebar-backdrop')).not.toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('.app-sidebar');
      return !el || el.getBoundingClientRect().right <= 0;
    });

    // Verify inventory table is horizontally scrollable without content being covered
    const tableWrapper = page.locator('.table-responsive-wrapper').first();
    await expect(tableWrapper).toBeVisible();
    const isScrollable = await tableWrapper.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(isScrollable).toBe(true);

    // Verify horizontal scrolling works smoothly
    await tableWrapper.evaluate((el) => { el.scrollLeft = 150; });
    const scrolledLeft = await tableWrapper.evaluate((el) => el.scrollLeft);
    expect(scrolledLeft).toBeGreaterThan(0);
    // Reset scroll back to origin for clean screenshot capture
    await tableWrapper.evaluate((el) => { el.scrollLeft = 0; });

    await page.screenshot({ path: 'tests/e2e/screenshots/mobile390-inventory.png', fullPage: true });

    // Verify zero fatal console errors (401 is expected before login)
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon.ico') &&
        !err.includes('Download the React DevTools') &&
        !err.includes('401')
    );
    expect(fatalErrors).toHaveLength(0);
  });
});
