import { test, expect } from '@playwright/test';

// ==========================================
// E2E: Home Page
// ==========================================

test.describe('Home Page', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Burmese Digital Store/);
  });

  test('should display the navbar with logo', async ({ page }) => {
    await page.goto('/');
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();
  });

  test('should have a link to the shop', async ({ page }) => {
    await page.goto('/');
    const shopLink = page.locator('a[href="/shop"]').first();
    await expect(shopLink).toBeVisible();
  });

  test('should have a link to VPN page', async ({ page }) => {
    await page.goto('/');
    const vpnLink = page.locator('a[href="/vpn"]').first();
    await expect(vpnLink).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});
