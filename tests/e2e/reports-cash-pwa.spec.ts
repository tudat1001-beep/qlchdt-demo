import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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

test.describe('A-03b: Real API Cashbook, Reports, XLSX Exports & PWA Verification', () => {
  test('E2E toàn diện: Manifest & Service Worker -> Sổ quỹ & Chi phí -> Báo cáo & Lợi nhuận -> Xuất Excel -> Ngoại tuyến từ chối ghi -> In hóa đơn & Responsive', async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // =========================================================================
    // 1. Kiểm tra Installable PWA Manifest & Icons
    // =========================================================================
    await page.goto('/');

    // Check link rel manifest
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');

    // Fetch and validate manifest.json content
    const manifestResponse = await page.request.get('/manifest.json');
    expect(manifestResponse.status()).toBe(200);
    const manifest = await manifestResponse.json();
    expect(manifest.name).toBe('QLCHDT - Quản trị Cửa hàng Điện thoại');
    expect(manifest.short_name).toBe('QLCHDT');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const icon192 = manifest.icons.find((i: { sizes?: string }) => i.sizes === '192x192');
    const icon512 = manifest.icons.find((i: { sizes?: string }) => i.sizes === '512x512');
    expect(icon192).toBeDefined();
    expect(icon512).toBeDefined();

    // Verify icon files are accessible
    const icon192Res = await page.request.get(icon192.src);
    expect(icon192Res.status()).toBe(200);
    const icon512Res = await page.request.get(icon512.src);
    expect(icon512Res.status()).toBe(200);

    // =========================================================================
    // 2. Đăng nhập hệ thống (POST /api/auth/login)
    // =========================================================================
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');
    await page.fill('#login-username', ADMIN_USER);
    await page.fill('#login-password', ADMIN_PASS);
    await page.click('button[type="submit"]');

    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText(ADMIN_USER);

    // =========================================================================
    // 3. Kiểm tra Service Worker Registration trong trình duyệt
    // =========================================================================
    const swRegistration = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      // Wait for registration to complete if pending
      const reg = await navigator.serviceWorker.getRegistration();
      return reg
        ? {
            scope: reg.scope,
            active: Boolean(reg.active),
            installing: Boolean(reg.installing),
            waiting: Boolean(reg.waiting),
          }
        : null;
    });

    // In Playwright Chrome test environment, verify service worker is recognized
    expect(swRegistration).not.toBeNull();
    expect(swRegistration?.scope).toContain('http://127.0.0.1:5174/');

    // =========================================================================
    // 4. Trạng thái kết nối trực tuyến (Online Network State Badge)
    // =========================================================================
    const networkBadge = page.locator('[data-testid="network-status"]');
    await expect(networkBadge).toBeVisible();
    await expect(networkBadge).toHaveClass(/online/);
    await expect(networkBadge).toContainText('Trực tuyến');

    // =========================================================================
    // 5. Tích hợp Sổ quỹ thu chi (`GET /api/cash` & `POST /api/cash`)
    // =========================================================================
    await navigateTo(page, 'Sổ quỹ thu chi');
    await expect(page.locator('.app-header .page-title')).toHaveText('Sổ quỹ thu chi');

    // Verify 3 server-derived balance cards exist
    const cashCard = page.locator('[data-testid="cash-balance-card"]');
    const bankCard = page.locator('[data-testid="bank-balance-card"]');
    const totalCard = page.locator('[data-testid="total-balance-card"]');
    await expect(cashCard).toBeVisible();
    await expect(bankCard).toBeVisible();
    await expect(totalCard).toBeVisible();

    // Verify table is visible
    const cashTable = page.locator('[data-testid="cashbook-table"]');
    await expect(cashTable).toBeVisible();

    // =========================================================================
    // 6. Xác thực Kiểm tra lỗi & Ghi nhận Phiếu chi thủ công (Manual Expense)
    // =========================================================================
    const createCashBtn = page.locator('[data-testid="create-cash-entry-btn"]');
    await createCashBtn.click();
    await expect(page.locator('#modal-title')).toHaveText('Lập phiếu thu / chi sổ quỹ');

    // Negative validation: enter 0 amount
    const amountInput = page.locator('#cash-amount');
    await amountInput.fill('0');
    await page.click('button[form="cash-entry-form"]');
    await expect(page.locator('.form-error')).toContainText('Số tiền phải lớn hơn 0 ₫');

    // Positive entry: Chi phí hoạt động
    const testExpenseAmount = 350000;
    const testExpenseNote = `Chi phí điện nước văn phòng E2E ${Date.now()}`;
    await amountInput.fill(testExpenseAmount.toString());
    await page.fill('#cash-note', testExpenseNote);

    // Select Cash method
    await page.click('button:has-text("Tiền mặt tại quỹ")');

    // Submit valid expense
    await page.click('button[form="cash-entry-form"]');

    // Verify success toast appears and modal closes
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page.locator('#modal-title')).not.toBeVisible();

    // Verify the newly created expense appears in the Cashbook table
    await expect(cashTable).toContainText(testExpenseNote);
    await expect(cashTable).toContainText('-350.000 ₫');
    await expect(cashTable).toContainText('Chi phí hoạt động');

    // =========================================================================
    // 7. Xuất Bảng kê Sổ quỹ ra XLSX (Preserve VND integers & dates)
    // =========================================================================
    const [cashbookDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-cashbook-btn"]'),
    ]);

    expect(cashbookDownload.suggestedFilename()).toMatch(/^so-quy-.*\.xlsx$/);
    const cashbookFilePath = await cashbookDownload.path();
    expect(cashbookFilePath).toBeTruthy();

    if (cashbookFilePath) {
      const fileBuffer = fs.readFileSync(cashbookFilePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      expect(workbook.SheetNames).toContain('So_Quy');

      const worksheet = workbook.Sheets['So_Quy'];
      expect(worksheet).toBeDefined();

      // Convert sheet to JSON rows to assert contents
      const sheetData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
      expect(sheetData.length).toBeGreaterThan(5);

      // Title row check
      expect(sheetData[0]?.[0]).toBe('SỔ QUỸ THU CHI - QLCHDT');

      // Verify that numeric VND cells preserve numeric integer type
      let foundNumericAmount = false;
      for (const cellKey of Object.keys(worksheet)) {
        if (cellKey.startsWith('!')) continue;
        const cell = worksheet[cellKey];
        if (cell && typeof cell.v === 'number' && cell.v === testExpenseAmount) {
          foundNumericAmount = true;
          expect(cell.t).toBe('n'); // Strict number type in Excel
          break;
        }
      }
      expect(foundNumericAmount).toBe(true);
    }

    // =========================================================================
    // 8. Tích hợp Báo cáo tài chính & Tồn kho (`GET /api/reports`)
    // =========================================================================
    await navigateTo(page, 'Báo cáo tài chính');
    await expect(page.locator('.app-header .page-title')).toHaveText('Báo cáo tài chính & Tồn kho');

    // Verify 8 distinct server-derived metric cards
    const metricRevenue = page.locator('[data-testid="report-metric-revenue"]');
    const metricCollected = page.locator('[data-testid="report-metric-collected"]');
    const metricCost = page.locator('[data-testid="report-metric-cost"]');
    const metricGrossProfit = page.locator('[data-testid="report-metric-gross-profit"]');
    const metricExpenses = page.locator('[data-testid="report-metric-expenses"]');
    const metricCustomerDebt = page.locator('[data-testid="report-metric-customer-debt"]');
    const metricSupplierDebt = page.locator('[data-testid="report-metric-supplier-debt"]');
    const metricStockValue = page.locator('[data-testid="report-metric-stock-value"]');

    await expect(metricRevenue).toBeVisible();
    await expect(metricCollected).toBeVisible();
    await expect(metricCost).toBeVisible();
    await expect(metricGrossProfit).toBeVisible();
    await expect(metricExpenses).toBeVisible();
    await expect(metricCustomerDebt).toBeVisible();
    await expect(metricSupplierDebt).toBeVisible();
    await expect(metricStockValue).toBeVisible();

    // Verify that collected metric card is styled and labeled visibly distinct from revenue
    await expect(metricRevenue).toContainText('Doanh thu thuần', { ignoreCase: true });
    await expect(metricCollected).toContainText('Tiền thực thu', { ignoreCase: true });

    // Verify Daily report table
    const dailyTable = page.locator('[data-testid="daily-report-table"]');
    await expect(dailyTable).toBeVisible();

    // Switch to Top bán chạy tab
    await page.click('button:has-text("Top bán chạy")');
    const bestSellersTable = page.locator('[data-testid="best-sellers-table"]');
    await expect(bestSellersTable).toBeVisible();

    // Switch to Cảnh báo tồn kho tab
    await page.click('button:has-text("Cảnh báo tồn kho")');
    const lowStockTable = page.locator('[data-testid="low-stock-table"]');
    await expect(lowStockTable).toBeVisible();

    // =========================================================================
    // 9. Xuất Báo cáo Tài chính nhiều Sheet ra XLSX
    // =========================================================================
    const [reportsDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-reports-btn"]'),
    ]);

    expect(reportsDownload.suggestedFilename()).toMatch(/^bao-cao-tai-chinh-.*\.xlsx$/);
    const reportsFilePath = await reportsDownload.path();
    expect(reportsFilePath).toBeTruthy();

    if (reportsFilePath) {
      const fileBuffer = fs.readFileSync(reportsFilePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      // Verify all 4 required sheets exist
      expect(workbook.SheetNames).toContain('Tong_Hop_Tai_Chinh');
      expect(workbook.SheetNames).toContain('Doanh_Thu_Theo_Ngay');
      expect(workbook.SheetNames).toContain('Top_Ban_Chay');
      expect(workbook.SheetNames).toContain('Canh_Bao_Ton_Kho');

      const summarySheet = workbook.Sheets['Tong_Hop_Tai_Chinh'];
      const summaryJson = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, { header: 1 });
      expect(summaryJson.length).toBeGreaterThan(6);

      // Verify numeric integers in summary sheet
      let hasNumericMetric = false;
      for (const cellKey of Object.keys(summarySheet)) {
        if (cellKey.startsWith('!')) continue;
        const cell = summarySheet[cellKey];
        if (cell && typeof cell.v === 'number') {
          hasNumericMetric = true;
          expect(cell.t).toBe('n');
        }
      }
      expect(hasNumericMetric).toBe(true);
    }

    // =========================================================================
    // 10. Chế độ Ngoại tuyến (Offline Read-Only) & Từ chối Ghi nhận tài chính
    // =========================================================================
    // Simulate network disconnection
    await context.setOffline(true);

    // Verify Network badge immediately reflects offline state
    await expect(networkBadge).toHaveClass(/offline/);
    await expect(networkBadge).toContainText('Ngoại tuyến (Chỉ xem)');

    // Verify Sticky offline warning banner is displayed
    const offlineBanner = page.locator('[data-testid="offline-alert-banner"]');
    await expect(offlineBanner).toBeVisible();
    await expect(offlineBanner).toContainText('Hệ thống đang hoạt động ở chế độ Ngoại tuyến (Chỉ xem)');

    // Navigate to Cashbook while offline
    await navigateTo(page, 'Sổ quỹ thu chi');
    await createCashBtn.click();
    await expect(page.locator('#modal-title')).toHaveText('Lập phiếu thu / chi sổ quỹ');

    // In modal, offline banner is visible
    await expect(page.locator('#cash-entry-form')).toContainText('Hệ thống đang ngoại tuyến');

    // Fill valid amount and attempt submit while offline
    await page.locator('#cash-amount').fill('100000');
    await page.click('button[form="cash-entry-form"]');

    // Must show clear rejection toast / error
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('Giao dịch bị từ chối');
    await expect(page.locator('.form-error')).toContainText('Giao dịch bị từ chối');

    // Close modal
    await page.click('button:has-text("Hủy bỏ")');

    // Restore online network
    await context.setOffline(false);
    await expect(networkBadge).toHaveClass(/online/);
    await expect(networkBadge).toContainText('Trực tuyến');
    await expect(offlineBanner).not.toBeVisible();

    // =========================================================================
    // 11. Kiểm tra Browser Invoice Print Flow & Media Print Stylesheet
    // =========================================================================
    await navigateTo(page, 'Phiếu bán & Thu nợ');
    await expect(page.locator('.app-header .page-title')).toHaveText('Phiếu bán & Thu nợ');

    // Click on the first sale row if available to open SaleDrawer
    const firstSaleRow = page.locator('tbody tr.row-clickable').first();
    const hasSaleRow = await firstSaleRow.isVisible().catch(() => false);

    if (hasSaleRow) {
      await firstSaleRow.click();
      await expect(page.locator('.drawer-card')).toBeVisible();

      // Verify Print invoice button is present
      const printBtn = page.locator('button:has-text("In hóa đơn / Lưu PDF")');
      await expect(printBtn).toBeVisible();

      // Verify .printable-invoice exists
      const printableInvoice = page.locator('.printable-invoice');
      await expect(printableInvoice).toBeVisible();

      // Emulate CSS @media print and assert print stylesheet visibility rules
      await page.emulateMedia({ media: 'print' });

      // In print mode, .no-print and sidebar should be hidden
      const noPrintDisplay = await page.locator('.no-print').first().evaluate((el) => {
        return window.getComputedStyle(el).display;
      });
      expect(noPrintDisplay).toBe('none');

      const sidebarDisplay = await page.locator('.app-sidebar').evaluate((el) => {
        return window.getComputedStyle(el).display;
      });
      expect(sidebarDisplay).toBe('none');

      // Printable invoice should remain visible
      const invoiceDisplay = await printableInvoice.evaluate((el) => {
        return window.getComputedStyle(el).display;
      });
      expect(invoiceDisplay).toBe('block');

      // Reset print emulation
      await page.emulateMedia({ media: null });

      // Close drawer
      await page.click('button:has-text("Đóng")');
    }

    // =========================================================================
    // 12. Kiểm tra Responsive Layouts & Chụp ảnh minh chứng
    // =========================================================================
    // Dismiss any existing toast notifications so screenshots are clean layout evidence
    while ((await page.locator('.toast button').count()) > 0) {
      await page.locator('.toast button').first().click();
      await page.waitForTimeout(100);
    }

    // Desktop 1280x720 screenshot for Cashbook & Reports
    await page.setViewportSize({ width: 1280, height: 720 });
    await navigateTo(page, 'Sổ quỹ thu chi');
    await page.screenshot({ path: 'tests/e2e/screenshots/desktop1280-cashbook.png', fullPage: false });

    await navigateTo(page, 'Báo cáo tài chính');
    await page.screenshot({ path: 'tests/e2e/screenshots/desktop1280-reports.png', fullPage: false });

    // Tablet 768x1024 screenshot
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigateTo(page, 'Sổ quỹ thu chi');
    await page.screenshot({ path: 'tests/e2e/screenshots/tablet768-cashbook.png', fullPage: false });

    // Mobile 393x851 screenshot & horizontal overflow verification
    await page.setViewportSize({ width: 393, height: 851 });
    await navigateTo(page, 'Báo cáo tài chính');
    await expect(page.locator('.app-header .page-title')).toBeVisible();

    // Verify no horizontal overflow in mobile viewport
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: 'tests/e2e/screenshots/mobile393-reports.png', fullPage: false });

    // Final assertion: no uncaught console errors
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('404') &&
        !err.includes('ERR_INTERNET_DISCONNECTED') &&
        !err.includes('Failed to load resource')
    );
    expect(criticalErrors).toEqual([]);
  });
});
