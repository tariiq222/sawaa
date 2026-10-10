import { expect, test } from '@playwright/test';

test('local public website renders', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.getByText('تبدأ اليوم')).toBeVisible();
});
