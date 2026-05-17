// Dashboard E2E — D1 login golden path
// Website: W1 guest booking · W2 client invoice

import { test, expect } from '@playwright/test';

/**
 * [D1] Dashboard login golden path — email + password flow
 *
 * Credentials: seeded by apps/backend/prisma/seed.ts
 *   SEED_EMAIL    (default: admin@sawaa-test.com)
 *   SEED_PASSWORD (default: Admin@1234)
 *
 * Flow: email → password → login → dashboard → logout
 */
test.describe('[D1] Dashboard login flow', () => {
  test('admin can log in, see home, and log out', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await page.waitForLoadState('domcontentloaded');

    // 2. Multi-step login wizard
    await page.locator('#identifier').fill('admin@sawaa-test.com');
    await page.getByRole('button', { name: 'متابعة' }).click();
    await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click();
    await page.locator('#password').fill('Admin@1234');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    // 3. Wait for redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // 4. Verify dashboard chrome is visible
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // 5. Log out via avatar dropdown
    const profileTrigger = page.locator('header').locator('button').filter({
      has: page.locator('[data-slot="avatar-fallback"]'),
    });
    await profileTrigger.click();

    const logoutBtn = page.getByRole('button', { name: 'تسجيل الخروج' });
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
    await logoutBtn.click();

    // 6. Confirm logged out — login form shows #identifier input
    await expect(page.locator('#identifier')).toBeVisible({ timeout: 10_000 });
  });
});
