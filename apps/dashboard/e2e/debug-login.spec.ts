import { test } from '@playwright/test';
import { loginAs } from './fixtures/auth';

test('debug login', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/bookings');
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: 'test-results/debug-login.png' });
  const hasHeader = await page.locator('header').first().isVisible();
  console.log('HAS HEADER:', hasHeader);
  console.log('URL:', page.url());
});
