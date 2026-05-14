// TODO post-launch: D2 create booking · D3 confirm → invoice
// Admin: A1 impersonate · A2 create organization · A3 plan editor
// Website: W1 guest booking · W2 client invoice

import { test, expect } from '@playwright/test';

/**
 * [D1] Dashboard login golden path — identifier-first flow
 *
 * Credentials: seeded by apps/backend/prisma/seed.ts
 *   SEED_EMAIL    (default: admin@sawaa-test.com)
 *   SEED_PASSWORD (default: Admin@1234)
 *
 * Flow: identifier → choose password → login → dashboard → logout
 */
test.describe('[D1] Dashboard login flow', () => {
  test('admin can log in, see home, and log out', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await page.waitForLoadState('domcontentloaded');

    // 2. Step 1 — enter identifier
    await page.locator('#identifier').fill('admin@sawaa-test.com');
    await page.getByRole('button', { name: 'متابعة' }).click();

    // 3. Step 2 — choose password method
    await expect(
      page.getByRole('button', { name: 'باستخدام كلمة المرور' }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click();

    // 4. Step 3 — fill password and submit
    await expect(page.locator('#password')).toBeVisible({ timeout: 10_000 });
    await page.locator('#password').fill('Admin@1234');
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    // 5. Wait for redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // 6. Verify dashboard chrome is visible
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // 7. Log out via avatar dropdown
    const profileTrigger = page.locator('header').locator('button').filter({
      has: page.locator('[data-slot="avatar-fallback"]'),
    });
    await profileTrigger.click();

    const logoutBtn = page.getByRole('button', { name: 'تسجيل الخروج' });
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
    await logoutBtn.click();

    // 8. Confirm logged out — identifier-first form shows #identifier input
    await expect(page.locator('#identifier')).toBeVisible({ timeout: 10_000 });
  });
});
