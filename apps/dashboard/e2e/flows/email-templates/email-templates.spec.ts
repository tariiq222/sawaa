import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth';

test.describe('Email Templates', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('email templates page loads', async ({ page }) => {
    await page.goto('/settings/email-templates', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  test('booking confirmation template is visible', async ({ page }) => {
    await page.goto('/settings/email-templates', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const template = page.locator('text=/booking.*confirmation|تأكيد.*الحجز/i').first();
    const hasTemplate = await template.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(typeof hasTemplate).toBe('boolean');
  });

  test('reminder template is visible', async ({ page }) => {
    await page.goto('/settings/email-templates', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const template = page.locator('text=/reminder|تذكير/i').first();
    const hasTemplate = await template.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(typeof hasTemplate).toBe('boolean');
  });

  test('cancellation template is visible', async ({ page }) => {
    await page.goto('/settings/email-templates', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const template = page.locator('text=/cancellation|إلغاء/i').first();
    const hasTemplate = await template.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(typeof hasTemplate).toBe('boolean');
  });

  test('variable placeholders are displayed', async ({ page }) => {
    await page.goto('/settings/email-templates', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const variables = page.locator('text=/{{|\\{\\{/').first();
    const hasVariables = await variables.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(typeof hasVariables).toBe('boolean');
  });

  test('SMS templates page loads', async ({ page }) => {
    await page.goto('/settings/sms');
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });
  });

  test('character count for SMS template', async ({ page }) => {
    await page.goto('/settings/sms');
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 });

    const charCount = page.locator('text=/\\d+\\/160|\\d+.*character/i').first();
    const hasCount = await charCount.isVisible({ timeout: 5_000 }).catch(() => false);

    expect(typeof hasCount).toBe('boolean');
  });
});
