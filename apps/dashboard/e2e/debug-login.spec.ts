import { test, expect } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test('debug login', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/bookings');
  // Wait for the authenticated shell header — the element this spec inspects below.
  await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: 'test-results/debug-login.png' });
  const hasHeader = await page.locator('header').first().isVisible();
  console.log('HAS HEADER:', hasHeader);
  console.log('URL:', page.url());
});
