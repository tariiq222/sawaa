import { test, expect } from '@playwright/test';

test('dashboard root renders', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.locator('body')).toBeVisible();
});
