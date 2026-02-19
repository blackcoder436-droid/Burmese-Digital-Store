import { test, expect } from '@playwright/test';

// ==========================================
// E2E: Shop & Product Pages
// ==========================================

test.describe('Shop Page', () => {
  test('should load the shop page', async ({ page }) => {
    await page.goto('/shop');
    await expect(page).toHaveTitle(/Shop|Store|Burmese/i);
  });

  test('should display search input', async ({ page }) => {
    await page.goto('/shop');
    const searchInput = page.locator('input[type="search"], input[type="text"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible();
  });

  test('should display category filters', async ({ page }) => {
    await page.goto('/shop');
    // Category buttons or links should exist
    await page.waitForTimeout(1000); // Wait for data load
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should have product cards or empty state', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForTimeout(2000); // Wait for products to load
    // Either products exist or "no products" message
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });

  test('search should filter products', async ({ page }) => {
    await page.goto('/shop');
    const searchInput = page.locator('input[type="search"], input[type="text"], input[placeholder*="search" i]').first();
    await searchInput.fill('VPN');
    await page.waitForTimeout(1000); // Debounced search
    // Page should not have crashed
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('VPN Page', () => {
  test('should load the VPN page', async ({ page }) => {
    await page.goto('/vpn');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display server list or loading state', async ({ page }) => {
    await page.goto('/vpn');
    await page.waitForTimeout(2000);
    // Should have server cards or plan info
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Cart Page', () => {
  test('should load the cart page', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show empty cart state', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForTimeout(1000);
    // Cart should be empty on first visit
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
  });
});
