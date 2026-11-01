import { test, expect, type Page } from '@playwright/test';

async function navigateTo(page: Page, label: string) {
  // Wait until layout finishes initial auth check and renders
  await expect(page.locator('.page-title')).toBeVisible();
  const mobileBtn = page.locator('.mobile-menu-btn');
  if (await mobileBtn.isVisible()) {
    await mobileBtn.click();
    await expect(page.locator('.app-sidebar')).toHaveClass(/sidebar-open/);
  }
  await page.click(`button.nav-item:has-text("${label}")`);
}

test.describe('Đối tác Khách hàng & Nhà cung cấp (Parties)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-001', username: 'admin' }),
      });
    });
    await page.route('/api/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });
  });

  test('Điều hướng sang Khách hàng, mở Drawer xem lịch sử và đóng bằng Escape', async ({ page }) => {
    const mockCustomers = [
      {
        id: 'c-1',
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        address: 'Hà Nội',
        note: 'Khách quen',
        debt: 2500000,
      },
    ];

    await page.route('/api/customers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: mockCustomers }),
      });
    });

    await page.route('/api/customers/c-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockCustomers[0],
          sales: [
            {
              id: 's-1',
              number: 'HD-2026-001',
              total: 15000000,
              paid: 12500000,
              debt: 2500000,
              status: 'completed',
              created_at: '2026-11-01T08:00:00Z',
            },
          ],
          payments: [],
          warranties: [],
        }),
      });
    });

    await page.goto('/');

    // Navigate to Customers via Sidebar (handles desktop & mobile)
    await navigateTo(page, 'Khách hàng');
    await expect(page.locator('.page-title')).toHaveText('Quản lý Khách hàng');

    // Verify row displays formatted VND debt
    await expect(page.locator('.table-misa tbody tr')).toHaveCount(1);
    await expect(page.locator('.col-money')).toContainText('2.500.000 ₫');

    // Click row to open Drawer
    await page.click('.table-misa tbody tr');

    const drawer = page.locator('.drawer-card');
    await expect(drawer).toBeVisible();
    await expect(page.locator('#drawer-title')).toHaveText('Nguyễn Văn An');

    // Switch to Sales tab
    await page.click('button:has-text("Lịch sử mua")');
    await expect(page.locator('.col-sku')).toHaveText('HD-2026-001');

    // Press Escape to close Drawer
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('Điều hướng sang Nhà cung cấp và mở form thêm mới', async ({ page }) => {
    await page.route('/api/suppliers*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto('/');
    await navigateTo(page, 'Nhà cung cấp');
    await expect(page.locator('.page-title')).toHaveText('Quản lý Nhà cung cấp');

    // Check empty state
    await expect(page.locator('.empty-state-title')).toHaveText('Chưa có nhà cung cấp nào');

    // Click Thêm nhà cung cấp
    await page.click('button:has-text("Thêm nhà cung cấp")');

    const modal = page.locator('.modal-card');
    await expect(modal).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Thêm nhà cung cấp mới');

    await page.fill('#supplier-name', 'DigiTech Hà Nội');
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
