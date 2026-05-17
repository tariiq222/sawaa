/**
 * e2e/fixtures/auth.ts
 *
 * Auth persona helper for Playwright tests.
 *
 * Usage:
 *   import { loginAs } from '../fixtures/auth';
 *   await loginAs(page, 'admin');
 *
 * Credentials are sourced from env vars (set in CI) or fall back to the
 * seeded defaults from apps/backend/prisma/seed.ts (via TEST_TENANT).
 *
 */

import { Page, expect } from '@playwright/test';
import { TEST_TENANT } from './tenant';

export type Persona = 'admin' | 'owner' | 'receptionist';

/**
 * Credentials keyed by persona.
 *
 * - admin / owner: resolved from TEST_TENANT so they stay in sync with
 *   the backend seed script (SEED_EMAIL / SEED_PASSWORD env vars or defaults).
 * - receptionist: sourced from its own env vars; falls back to a known
 *   test default.  A receptionist membership must be seeded separately if
 *   receptionist-specific tests are needed.
 */
const PERSONA_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  admin: {
    email: TEST_TENANT.adminEmail,
    password: TEST_TENANT.adminPassword,
  },
  owner: {
    // Owner uses the same seeded user as admin in the default test org.
    // Override via SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD when a distinct
    // owner account is seeded.
    email: process.env.SEED_OWNER_EMAIL ?? TEST_TENANT.adminEmail,
    password: process.env.SEED_OWNER_PASSWORD ?? TEST_TENANT.adminPassword,
  },
  receptionist: {
    email: process.env.SEED_RECEPTIONIST_EMAIL ?? 'receptionist@sawaa-test.com',
    password: process.env.SEED_RECEPTIONIST_PASSWORD ?? 'Recept@1234',
  },
};

/**
 * Log in as a given persona by filling the login form.
 *
 * ⚠️  Prefer `test.use({ storageState: storageStatePath('admin') })` in spec files
 *    so Playwright reuses a pre-authenticated context.  Only call `loginAs` when
 *    you need a *different* persona mid-test or when the setup state is stale.
 */
export async function loginAs(page: Page, persona: Persona = 'admin'): Promise<void> {
  const { email, password } = PERSONA_CREDENTIALS[persona];

  // Fast path: already authenticated (storageState or previous login)
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  // Give client-side auth check a moment to settle
  await page.waitForTimeout(1_000);
  const isLoginFormVisible = await page.locator('#identifier').isVisible().catch(() => false);
  if (!isLoginFormVisible) {
    return;
  }

  // Multi-step login wizard
  await page.locator('#identifier').fill(email);
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click();
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

  // Wait for login to complete (header becomes visible, login form disappears)
  await expect(page.locator('header').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#identifier')).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Log out the current user via the header user menu.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/');

  // Header user button (last icon button in header)
  const userButton = page.locator('header button').filter({ has: page.locator('svg') }).last();
  if (await userButton.isVisible()) {
    await userButton.click();
    await page.waitForTimeout(300);

    const logoutButton = page.locator('text=/logout|تسجيل الخروج/i');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('/login', { timeout: 10_000 });
    }
  }
}

/**
 * Path to the Playwright storageState file for a persona.
 *
 * Usage in a spec file:
 *   test.use({ storageState: storageStatePath('admin') });
 */
export function storageStatePath(persona: Persona): string {
  return `playwright/.auth/${persona}.json`;
}

/**
 * Return the raw credentials for a persona (useful for API-level auth in
 * seed helpers that need a token outside of a browser context).
 */
export function getPersonaCredentials(persona: Persona): { email: string; password: string } {
  return PERSONA_CREDENTIALS[persona];
}
