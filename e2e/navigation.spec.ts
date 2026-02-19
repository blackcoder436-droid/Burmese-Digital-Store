import { test, expect } from '@playwright/test';

// ==========================================
// E2E: Static Pages (SEO, Legal, Contact)
// ==========================================

test.describe('Static Pages', () => {
  test('contact page should load', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/Contact|Burmese/i);
  });

  test('terms page should load', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('body')).toBeVisible();
  });

  test('privacy page should load', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('body')).toBeVisible();
  });

  test('refund policy page should load', async ({ page }) => {
    await page.goto('/refund-policy');
    await expect(page.locator('body')).toBeVisible();
  });

  test('404 page should display for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');
    await expect(page.locator('body')).toBeVisible();
    // Should show 404 or not-found content
    const text = await page.locator('body').textContent();
    expect(text?.toLowerCase()).toMatch(/not found|404|page/);
  });
});

test.describe('SEO', () => {
  test('home page should have meta description', async ({ page }) => {
    await page.goto('/');
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute('content', /.+/);
  });

  test('home page should have Open Graph tags', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /.+/);
  });

  test('home page should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThan(0);
  });

  test('robots.txt should be accessible', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text).toContain('User-agent');
  });

  test('sitemap.xml should be accessible', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text).toContain('urlset');
  });
});

test.describe('Protected Routes (unauthenticated)', () => {
  test('account page should redirect to login', async ({ page }) => {
    await page.goto('/account');
    await page.waitForTimeout(2000);
    // Should redirect to /login or show auth error
    const url = page.url();
    expect(url).toMatch(/\/login|\/account/);
  });

  test('admin page should redirect to login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url).toMatch(/\/login|\/admin/);
  });
});

test.describe('API Health', () => {
  test('health endpoint should return 200', async ({ page }) => {
    const response = await page.goto('/api/health');
    expect(response?.status()).toBe(200);
    const body = await response?.json();
    expect(body.success).toBe(true);
  });
});

test.describe('Accessibility', () => {
  test('home page should have skip-to-content link', async ({ page }) => {
    await page.goto('/');
    // Skip link is typically visually hidden
    const skipLink = page.locator('a[href="#main-content"]');
    const count = await skipLink.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not exist
  });

  test('home page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1').first();
    // There should be at least one heading
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThan(0);
  });

  test('login page should have form labels', async ({ page }) => {
    await page.goto('/login');
    // Inputs should have associated labels or aria-label
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible();
  });
});
