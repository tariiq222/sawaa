import { expect, test } from '@playwright/test';

test('local dashboard renders', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response?.ok()).toBe(true);
  await expect(page.getByText(/البريد الإلكتروني أو رقم الجوال|Email or mobile number/)).toBeVisible();
});
