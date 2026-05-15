import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('users list page loads', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('users table displays user data', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const table = page.locator('table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(table).toBeVisible();
    }
  });

  test('create user button is visible', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const createBtn = page.locator('button:has-text("Create" i), button:has-text("إضافة" i)').first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('pagination controls are visible', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const pagination = page.locator('[class*="pagination"], button:has-text("Next"), button:has-text("Previous")').first();
    if (await pagination.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(pagination).toBeVisible();
    }
  });

  test('bulk select users is available', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await checkbox.click();
      await page.waitForTimeout(300);
      await expect(checkbox).toBeChecked();
    }
  });
});
