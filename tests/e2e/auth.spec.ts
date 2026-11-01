import { test, expect } from '@playwright/test';

test.describe('Xác thực & App Shell (Auth)', () => {
  test('Hiển thị màn hình đăng nhập chuẩn tiếng Việt khi chưa xác thực', async ({ page }) => {
    // Intercept /api/auth/me to simulate unauthenticated visitor
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' } }),
      });
    });

    await page.goto('/');

    // Check header and title
    await expect(page.locator('.auth-title')).toHaveText('Đăng nhập hệ thống');
    await expect(page.locator('.auth-subtitle')).toContainText('QLCHDT');

    // Check accessible inputs
    const usernameInput = page.locator('#login-username');
    const passwordInput = page.locator('#login-password');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Check keyboard navigation: Enter in username moves focus to password
    await usernameInput.fill('admin');
    await usernameInput.press('Enter');
    await expect(passwordInput).toBeFocused();
  });

  test('Hiển thị thông báo lỗi khi đăng nhập thất bại với mã 401', async ({ page }) => {
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' } }),
      });
    });

    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sai mật khẩu' } }),
      });
    });

    await page.goto('/');

    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'wrong-pass');
    await page.click('button[type="submit"]');

    const alertBox = page.locator('[role="alert"]');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('Tên đăng nhập hoặc mật khẩu không chính xác');
  });

  test('Đăng nhập thành công chuyển sang giao diện quản trị với navy sidebar', async ({ page }) => {
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Chưa đăng nhập' } }),
      });
    });

    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-001', username: 'admin' }),
      });
    });

    await page.route('/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto('/');
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'correct-pass');
    await page.click('button[type="submit"]');

    // Sidebar should now be visible
    await expect(page.locator('.app-sidebar')).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText('admin');
    await expect(page.locator('.page-title')).toHaveText('Hàng hóa & Thiết bị');
  });
});
