/**
 * dashboard-by-role.spec.ts
 *
 * Smoke coverage for the role-based dashboard home (Plan
 * `2026-05-06-dashboard-role-based-home.md`, Task 10).
 *
 * Asserts that role-gated widgets on `/` render (or don't) according to
 * the active membership role.
 *
 * Login note: uses the same identifier-first flow proven green by
 * `e2e/smoke/login.spec.ts`. The shared `loginAs` fixture in
 * `e2e/fixtures/auth.ts` still targets the old single-step form
 * (`#email` / `#password`) and currently fails on the live login
 * screen — fixing that fixture is out of scope for Task 10.
 *
 * Seed status (2026-05-06):
 *   - OWNER         → seeded (apps/backend/prisma/seed.ts upserts a
 *                     single Membership with role=OWNER).
 *   - RECEPTIONIST  → NOT seeded by default; gated on
 *                     SEED_RECEPTIONIST_EMAIL/SEED_RECEPTIONIST_PASSWORD.
 *                     Skipped locally.
 *   - EMPLOYEE      → NOT seeded; skipped pending a seed update
 *                     (out of scope for Task 10).
 */
import { test, expect, Page } from '@playwright/test';

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? process.env.SEED_EMAIL ?? 'admin@sawaa-test.com';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? process.env.SEED_PASSWORD ?? 'Admin@1234';

const RECEPTIONIST_EMAIL = process.env.SEED_RECEPTIONIST_EMAIL ?? 'receptionist@sawaa-test.com';
const RECEPTIONIST_PASSWORD = process.env.SEED_RECEPTIONIST_PASSWORD ?? 'Recept@1234';

const EMPLOYEE_EMAIL = process.env.SEED_EMPLOYEE_EMAIL ?? 'employee@sawaa-test.com';
const EMPLOYEE_PASSWORD = process.env.SEED_EMPLOYEE_PASSWORD ?? 'Employee@1234';

async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState('domcontentloaded');

  await page.locator('#identifier').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  // Wait for header chrome to confirm we're authenticated (mirrors login.spec).
  await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });
}

test.describe('Dashboard home — role-based widgets', () => {
  test('OWNER sees QuickActions', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.waitForURL('/', { timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId('quick-actions')).toBeVisible();
  });

  test('RECEPTIONIST sees QuickActions', async ({ page }) => {
    test.skip(
      !RECEPTIONIST_EMAIL || !RECEPTIONIST_PASSWORD,
      'No receptionist seed user — set SEED_RECEPTIONIST_EMAIL/SEED_RECEPTIONIST_PASSWORD or seed a RECEPTIONIST membership in apps/backend/prisma/seed.ts.',
    );
    await loginAs(page, RECEPTIONIST_EMAIL!, RECEPTIONIST_PASSWORD!);
    await page.goto('/');
    await expect(page.getByTestId('quick-actions')).toBeVisible();
  });

  test('EMPLOYEE sees no QuickActions', async ({ page }) => {
    test.skip(
      !EMPLOYEE_EMAIL || !EMPLOYEE_PASSWORD,
      'No employee seed user — set SEED_EMPLOYEE_EMAIL/SEED_EMPLOYEE_PASSWORD or seed an EMPLOYEE membership in apps/backend/prisma/seed.ts.',
    );
    await loginAs(page, EMPLOYEE_EMAIL!, EMPLOYEE_PASSWORD!);
    await page.goto('/');
    await expect(page.getByTestId('quick-actions')).toHaveCount(0);
  });
});
