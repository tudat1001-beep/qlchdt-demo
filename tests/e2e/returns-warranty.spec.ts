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

test.describe('Real API Returns & Warranties End-to-End Flow (Guarded _test Database)', () => {
  test('E2E toàn diện: Trả hàng một phần -> Bảo hành máy khách (không có release_to_stock) -> Hủy phiếu bán còn lại -> Trả hàng NCC (Máy + Phụ kiện) -> Bảo hành tồn kho cách ly & hoàn kho khả dụng -> Kiểm tra lỗi & Responsive', async ({
    page,
  }) => {
    test.setTimeout(180000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const testSupplierName = `NCC Toàn Cầu ${uniqueId}`;
    const testCustomerName = `Khách Hàng VIP ${uniqueId}`;
    const testPhoneSku = `IP15-${uniqueId}`;
    const testPhoneName = `iPhone 15 Pro Max ${uniqueId}`;
    const testAccSku = `CAP-C-${uniqueId}`;
    const testAccName = `Cáp sạc Type-C Bọc Dù ${uniqueId}`;

    // 15-digit IMEIs
    const imeiSale = `86${Math.floor(1000000000000 + Math.random() * 9000000000000).toString()}`.slice(0, 15);
    const imeiSupplierReturn = `86${Math.floor(1000000000000 + Math.random() * 9000000000000).toString()}`.slice(0, 15);
    const imeiStockWarranty = `86${Math.floor(1000000000000 + Math.random() * 9000000000000).toString()}`.slice(0, 15);

    // ==========================================
    // 1. Đăng nhập hệ thống (POST /api/auth/login)
    // ==========================================
    await page.goto('/');
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');
    await page.fill('#login-username', ADMIN_USER);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 15000 });

    // ==========================================
    // 2. Tạo Đối tác & Hàng hóa nền tảng
    // ==========================================
    await navigateTo(page, 'Nhà cung cấp');
    await page.click('button:has-text("Thêm nhà cung cấp")');
    await page.fill('#supplier-name', testSupplierName);
    await page.fill('#supplier-phone', '0988776655');
    await page.click('button[type="submit"][form="supplier-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`)).toBeVisible();

    await navigateTo(page, 'Khách hàng');
    await page.click('button:has-text("Thêm khách hàng")');
    await page.fill('#customer-name', testCustomerName);
    await page.fill('#customer-phone', '0912345678');
    await page.click('button[type="submit"][form="customer-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`)).toBeVisible();

    await navigateTo(page, 'Hàng hóa & Thiết bị');
    // Tạo Phone
    await page.click('button:has-text("Thêm sản phẩm")');
    await page.fill('#product-sku', testPhoneSku);
    await page.fill('#product-name', testPhoneName);
    await page.selectOption('#product-kind', 'PHONE');
    await page.fill('#product-brand', 'Apple');
    await page.fill('#product-sale-price', '22000000');
    await page.click('button[type="submit"][form="product-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testPhoneSku}")`)).toBeVisible();

    // Tạo Accessory
    await page.click('button:has-text("Thêm sản phẩm")');
    await page.fill('#product-sku', testAccSku);
    await page.fill('#product-name', testAccName);
    await page.selectOption('#product-kind', 'ACCESSORY');
    await page.fill('#product-brand', 'Apple');
    await page.fill('#product-sale-price', '250000');
    await page.click('button[type="submit"][form="product-form"]');
    await expect(page.locator('.modal-card')).not.toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${testAccSku}")`)).toBeVisible();

    // ==========================================
    // 3. Nhập hàng: 3 Điện thoại (imeiSale, imeiSupplierReturn, imeiStockWarranty) + 15 Phụ kiện
    // ==========================================
    await navigateTo(page, 'Nhập hàng & Kho');
    await page.click('button:has-text("Nhập hàng mới")');
    await expect(page.locator('.modal-card')).toBeVisible();

    // Chọn NCC
    const supSelect = page.locator('#purchase-form select').first();
    const supVal = await supSelect.locator(`option:has-text("${testSupplierName}")`).getAttribute('value');
    await supSelect.selectOption(supVal!);

    // Dòng 1: Phone (3 máy)
    const prodSelects = page.locator('#purchase-form select').filter({ hasText: '-- Chọn sản phẩm --' });
    const p1Select = prodSelects.first();
    const phoneVal = await p1Select.locator(`option:has-text("${testPhoneSku}")`).getAttribute('value');
    await p1Select.selectOption(phoneVal!);
    await page.fill('[data-testid="unit-cost-0"]', '18000000');

    // Máy 1: imeiSale
    await page.locator('#purchase-form input[placeholder*="15 số IMEI"]').first().fill(imeiSale);

    // Thêm máy 2: imeiSupplierReturn
    await page.click('button:has-text("Thêm IMEI")');
    await page.locator('#purchase-form input[placeholder*="15 số IMEI"]').nth(1).fill(imeiSupplierReturn);

    // Thêm máy 3: imeiStockWarranty
    await page.click('button:has-text("Thêm IMEI")');
    await page.locator('#purchase-form input[placeholder*="15 số IMEI"]').nth(2).fill(imeiStockWarranty);

    // Dòng 2: Accessory (15 cái)
    await page.click('button:has-text("Thêm dòng hàng")');
    const p2Select = page.locator('#purchase-form select').filter({ hasText: '-- Chọn sản phẩm --' }).nth(1);
    const accVal = await p2Select.locator(`option:has-text("${testAccSku}")`).getAttribute('value');
    await p2Select.selectOption(accVal!);
    await page.fill('[data-testid="unit-cost-1"]', '100000');
    await page.fill('[data-testid="accessory-qty-1"]', '15');

    // Thanh toán một phần: 30.000.000 đ tiền mặt (còn lại nợ NCC)
    await page.fill('#purchase-cash', '30000000');
    await page.click('button[form="purchase-form"]:has-text("Hoàn tất & Nhập kho")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // Đóng drawer nhập hàng nếu mở
    const closePBtn = page.locator('button[aria-label="Đóng ngăn chi tiết"]');
    if (await closePBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closePBtn.click();
    }

    // ==========================================
    // 4. Bán hàng POS: Bán imeiSale + 4 Phụ kiện cho Khách hàng
    // ==========================================
    await navigateTo(page, 'Bán hàng (POS)');
    const posSearch = page.locator('input[placeholder*="Tìm sản phẩm, SKU hoặc gõ 15 số IMEI"]');
    await posSearch.fill(imeiSale);
    await page.locator('button:has-text("Chọn")').first().click();

    await posSearch.fill(testAccSku);
    await page.locator('button:has-text("Thêm")').first().click();

    // Sửa số lượng phụ kiện lên 4 cái
    const qtyCart = page.locator('.card:has-text("Giỏ hàng") input[type="number"][min="1"]');
    await qtyCart.fill('4');

    // Chọn khách hàng
    const custSelect = page.locator('#pos-customer-select');
    const custVal = await custSelect.locator(`option:has-text("${testCustomerName}")`).getAttribute('value');
    await custSelect.selectOption(custVal!);

    // Thanh toán một phần: 15.000.000 đ tiền mặt, còn lại nợ
    await page.fill('#pos-cash', '15000000');
    await page.click('button:has-text("Xác nhận bán hàng")');

    // Drawer hóa đơn bán hàng mở ra
    await expect(page.locator('.drawer-card:has-text("HÓA ĐƠN BÁN HÀNG")')).toBeVisible({ timeout: 15000 });
    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 5. Trả hàng một phần (POST /returns) & Kiểm tra API Error bảo toàn input
    // ==========================================
    await navigateTo(page, 'Phiếu bán & Thu nợ');
    const saleRow = page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`);
    await expect(saleRow).toBeVisible();
    await saleRow.locator('button').first().click(); // Open SaleDrawer

    await expect(page.locator('.drawer-card')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("HÓA ĐƠN BÁN HÀNG")')).toBeVisible();

    // Bấm nút "Trả hàng"
    await page.click('.drawer-card button:has-text("Trả hàng")');
    await expect(page.locator('.modal-card:has-text("Trả hàng cho hóa đơn")')).toBeVisible();

    // KIỂM TRA BẢO TOÀN INPUT KHI LỖI API:
    // Thử bấm xác nhận mà chưa nhập lý do -> Hiển thị cảnh báo và giữ nguyên form
    await page.click('button[form="sale-return-form"]:has-text("Xác nhận trả hàng")');
    await expect(page.locator('.modal-card .alert-danger')).toBeVisible();

    // Điền lý do và chọn trả 2 phụ kiện
    await page.fill('#sale-return-reason', 'Khách đổi ý trả bớt 2 phụ kiện');
    // Tìm dòng phụ kiện trong modal trả hàng và điền số lượng 2
    const accReturnInput = page.locator(`.modal-card tr:has-text("${testAccName}") input[type="number"]`);
    await accReturnInput.fill('2');

    // Submit trả hàng hợp lệ
    await page.click('button[form="sale-return-form"]:has-text("Xác nhận trả hàng")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // KIỂM CHỨNG TỔNG SERVER-DERIVED TRONG SALE DRAWER:
    // Trạng thái đơn bán cập nhật thành "Trả một phần" (partially_returned)
    await expect(page.locator('.drawer-card .badge-partially_returned').first()).toHaveText('Trả một phần');
    await expect(page.locator('.drawer-card:has-text("Giá trị hàng đã trả lại")')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Doanh thu ròng thực tế")')).toBeVisible();
    // Lịch sử trả hàng xuất hiện trong drawer
    await expect(page.locator('.drawer-card:has-text("Lịch sử trả hàng & Hủy phiếu")')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Khách đổi ý trả bớt 2 phụ kiện")')).toBeVisible();

    // Đóng SaleDrawer để tiếp tục - xác nhận nút Đóng hiển thị và nằm trọn trong viewport
    const closeBtn = page.locator('.drawer-card button:has-text("Đóng")');
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toBeInViewport();
    await closeBtn.click();
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 6. Bảo hành Thiết bị Khách hàng đã bán (sở hữu khách - TUYỆT ĐỐI KHÔNG CÓ release_to_stock)
    // ==========================================
    await navigateTo(page, 'Hồ sơ bảo hành');
    await expect(page.locator('.app-header .page-title')).toHaveText('Hồ sơ bảo hành');

    await page.click('button:has-text("Tiếp nhận bảo hành")');
    await expect(page.locator('.modal-card:has-text("Tiếp nhận bảo hành thiết bị")')).toBeVisible();

    // Tìm kiếm IMEI máy khách (imeiSale)
    await page.fill('#device-search-input', imeiSale);
    await page.locator(`.modal-card div:has-text("${imeiSale}")`).first().click();

    // Xác nhận giao diện hiển thị: Thiết bị khách hàng đã mua
    await expect(page.locator('.modal-card:has-text("sở hữu của khách hàng")')).toBeVisible();

    // Nhập mô tả lỗi
    await page.fill('#warranty-issue-input', 'Khách báo micro đàm thoại không nghe rõ');
    await page.click('button[form="warranty-receive-form"]:has-text("Xác nhận tiếp nhận")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // Kiểm tra dòng hồ sơ trong bảng bảo hành
    const customerWarrantyRow = page.locator(`.table-misa tbody tr:has-text("${imeiSale}")`);
    await expect(customerWarrantyRow).toBeVisible();
    await expect(customerWarrantyRow.locator('.badge-received')).toHaveText('Tiếp nhận');

    // Mở WarrantyDrawer cho máy khách
    await customerWarrantyRow.locator('button').first().click();
    await expect(page.locator('.drawer-card')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Máy khách hàng đã mua")')).toBeVisible();

    // Chuyển trạng thái sang processing
    await page.click('.drawer-card button:has-text("Chuyển sang: Đang xử lý")');
    await expect(page.locator('.modal-card:has-text("Xác nhận chuyển trạng thái: Đang xử lý")')).toBeVisible();
    await page.fill('#warranty-resolution-input', 'Kỹ thuật nhận kiểm tra cụm mic');
    await page.click('button[form="warranty-transition-form"]:has-text("Xác nhận cập nhật")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.drawer-card .badge-processing')).toBeVisible();

    // Chuyển trạng thái sang completed:
    // TUYỆT ĐỐI KHÔNG CÓ release_to_stock cho thiết bị khách hàng sở hữu!
    await page.click('.drawer-card button:has-text("Hoàn tất bảo hành")');
    await expect(page.locator('.modal-card:has-text("Xác nhận chuyển trạng thái: Hoàn tất bảo hành")')).toBeVisible();
    // Xác nhận KHÔNG có checkbox release_to_stock
    await expect(page.locator('.modal-card input[type="checkbox"]')).not.toBeVisible();
    await expect(page.locator('.modal-card:has-text("Thiết bị thuộc sở hữu của khách hàng; không đưa vào tồn kho")')).toBeVisible();

    await page.fill('#warranty-resolution-input', 'Đã vệ sinh màng mic đàm thoại, test nghe gọi rõ ràng');
    await page.click('button[form="warranty-transition-form"]:has-text("Xác nhận cập nhật")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.drawer-card .badge-completed')).toBeVisible();

    // Đóng WarrantyDrawer
    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 7. Hủy phần còn lại của phiếu bán (POST /sales/:id/cancel)
    // ==========================================
    await navigateTo(page, 'Phiếu bán & Thu nợ');
    const saleRowAfterW = page.locator(`.table-misa tbody tr:has-text("${testCustomerName}")`);
    await saleRowAfterW.locator('button').first().click();

    await expect(page.locator('.drawer-card')).toBeVisible();
    await page.click('.drawer-card button:has-text("Hủy phiếu bán")');
    await expect(page.locator('.modal-card:has-text("Xác nhận hủy phiếu bán")')).toBeVisible();

    await page.fill('#sale-cancel-reason', 'Khách trả nốt phần còn lại của đơn hàng');
    await page.click('button[form="sale-cancel-form"]:has-text("Xác nhận hủy phiếu bán")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // Kiểm tra trạng thái đã chuyển sang "Đã hủy" (cancelled)
    await expect(page.locator('.drawer-card .badge-cancelled').first()).toBeVisible();
    await expect(page.locator('.drawer-card button:has-text("Trả hàng")')).not.toBeVisible();
    await expect(page.locator('.drawer-card button:has-text("Hủy phiếu bán")')).not.toBeVisible();

    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 8. Trả hàng nhà cung cấp (POST /purchase-returns)
    // ==========================================
    await navigateTo(page, 'Nhập hàng & Kho');
    const purchaseRow = page.locator(`.table-misa tbody tr:has-text("${testSupplierName}")`);
    await expect(purchaseRow).toBeVisible();
    await purchaseRow.locator('button').first().click();

    await expect(page.locator('.drawer-card')).toBeVisible();
    await page.click('.drawer-card button:has-text("Trả hàng cho NCC")');
    await expect(page.locator('.modal-card:has-text("Trả hàng cho nhà cung cấp")')).toBeVisible();

    // KIỂM TRA BẢO TOÀN INPUT KHI LỖI:
    await page.click('button[form="purchase-return-form"]:has-text("Xác nhận trả hàng NCC")');
    await expect(page.locator('.modal-card .alert-danger')).toBeVisible();

    // Chọn máy imeiSupplierReturn để trả NCC
    await page.locator(`.modal-card label:has-text("${imeiSupplierReturn}") input[type="checkbox"]`).check();

    // Chọn trả 3 phụ kiện
    const pAccInput = page.locator(`.modal-card input[id^="acc-qty-"]`);
    await pAccInput.fill('3');

    // Nhập lý do
    await page.fill('#purchase-return-reason', 'Hàng giao dư và 1 máy lỗi ngoại quan trả lại NCC');
    await page.click('button[form="purchase-return-form"]:has-text("Xác nhận trả hàng NCC")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // KIỂM CHỨNG SERVER-DERIVED TOTALS TRONG PURCHASE DRAWER:
    await expect(page.locator('.drawer-card:has-text("Giá trị hàng đã trả lại NCC")')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Lịch sử trả hàng cho NCC")')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Hàng giao dư và 1 máy lỗi ngoại quan")')).toBeVisible();

    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // Kiểm tra IMEI đã trả NCC có trạng thái "Đã trả NCC"
    await page.click('button:has-text("Danh sách thiết bị")');
    await expect(page.locator(`.table-misa tbody tr:has-text("${imeiSupplierReturn}")`)).toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${imeiSupplierReturn}"):has-text("Đã trả NCC")`)).toBeVisible();

    // ==========================================
    // 9. Quy trình Bảo hành: Tồn kho cách ly & Hoàn kho khả dụng (release_to_stock)
    // ==========================================
    await navigateTo(page, 'Hồ sơ bảo hành');
    await expect(page.locator('.app-header .page-title')).toHaveText('Hồ sơ bảo hành');

    // Tiếp nhận bảo hành cho máy tồn kho imeiStockWarranty
    await page.click('button:has-text("Tiếp nhận bảo hành")');
    await expect(page.locator('.modal-card:has-text("Tiếp nhận bảo hành thiết bị")')).toBeVisible();

    await page.fill('#device-search-input', imeiStockWarranty);
    await page.locator(`.modal-card div:has-text("${imeiStockWarranty}")`).first().click();

    // Xác nhận cảnh báo cách ly đối với máy tồn kho
    await expect(page.locator('.modal-card:has-text("Cách ly (quarantine)")')).toBeVisible();

    await page.fill('#warranty-issue-input', 'Máy tồn kho xước nhẹ viền kính cần gửi đánh bóng thẩm mỹ');
    await page.click('button[form="warranty-receive-form"]:has-text("Xác nhận tiếp nhận")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });

    // Kiểm tra dòng hồ sơ bảo hành xuất hiện trong bảng
    const warrantyRow = page.locator(`.table-misa tbody tr:has-text("${imeiStockWarranty}")`);
    await expect(warrantyRow).toBeVisible();
    await expect(warrantyRow.locator('.badge-received')).toHaveText('Tiếp nhận');

    // Mở WarrantyDrawer
    await warrantyRow.locator('button').first().click();
    await expect(page.locator('.drawer-card')).toBeVisible();
    await expect(page.locator('.drawer-card:has-text("Hàng tồn kho cửa hàng")')).toBeVisible();

    // Chuyển trạng thái: received -> processing
    await page.click('.drawer-card button:has-text("Chuyển sang: Đang xử lý")');
    await expect(page.locator('.modal-card:has-text("Xác nhận chuyển trạng thái: Đang xử lý")')).toBeVisible();
    await page.fill('#warranty-resolution-input', 'Kỹ thuật viên phòng bảo hành tiếp nhận kiểm tra');
    await page.click('button[form="warranty-transition-form"]:has-text("Xác nhận cập nhật")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.drawer-card .badge-processing')).toBeVisible();

    // Chuyển trạng thái: processing -> completed VỚI release_to_stock
    await page.click('.drawer-card button:has-text("Hoàn tất bảo hành")');
    await expect(page.locator('.modal-card:has-text("Xác nhận chuyển trạng thái: Hoàn tất bảo hành")')).toBeVisible();

    // Xác nhận CÓ checkbox release_to_stock đối với máy tồn kho
    const releaseCheckbox = page.locator('.modal-card input[type="checkbox"]');
    await expect(releaseCheckbox).toBeVisible();
    await releaseCheckbox.check();
    await page.fill('#warranty-resolution-input', 'Đã xử lý đạt chuẩn thẩm mỹ 99%, hoàn trả kho khả dụng');
    await page.click('button[form="warranty-transition-form"]:has-text("Xác nhận cập nhật")');
    await expect(page.locator('.modal-card')).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator('.drawer-card .badge-completed')).toBeVisible();

    await page.click('.drawer-card button:has-text("Đóng")');
    await expect(page.locator('.drawer-card')).not.toBeVisible();

    // ==========================================
    // 10. Kiểm tra thiết bị sau khi release_to_stock đã trở lại "Sẵn sàng bán"
    // ==========================================
    await navigateTo(page, 'Nhập hàng & Kho');
    await page.click('button:has-text("Danh sách thiết bị")');
    await expect(page.locator(`.table-misa tbody tr:has-text("${imeiStockWarranty}")`)).toBeVisible();
    await expect(page.locator(`.table-misa tbody tr:has-text("${imeiStockWarranty}"):has-text("Sẵn sàng bán")`)).toBeVisible();

    // Xác nhận không có ngoại lệ console lỗi nghiêm trọng
    console.log('Recorded console errors:', consoleErrors);
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Failed to load resource')
    );
    expect(fatalErrors.length).toBe(0);
  });
});
