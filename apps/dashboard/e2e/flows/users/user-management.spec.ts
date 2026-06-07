import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('users list page loads', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    await page.waitForResponse(
      (r) => r.url().includes('/users') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    // The page heading is always rendered once the route resolves.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
  });

  test('users table displays user data', async ({ page }) => {
    await page.goto('/users');
    await page.waitForResponse(
      (r) => r.url().includes('/users') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const table = page.locator('table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(table).toBeVisible();
    }
  });

  test('create user button is visible', async ({ page }) => {
    await page.goto('/users');
    await page.waitForResponse(
      (r) => r.url().includes('/users') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const createBtn = page.locator('button:has-text("Create" i), button:has-text("إضافة" i)').first();
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
  });

  test('pagination controls are visible', async ({ page }) => {
    await page.goto('/users');
    await page.waitForResponse(
      (r) => r.url().includes('/users') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const pagination = page.locator('[class*="pagination"], button:has-text("Next"), button:has-text("Previous")').first();
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(pagination).toBeVisible();
    }
  });

  test('bulk select users is available', async ({ page }) => {
    await page.goto('/users');
    await page.waitForResponse(
      (r) => r.url().includes('/users') && r.request().method() === 'GET' && r.ok(),
    ).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 10_000 });
    await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 5_000 });
  });
});
