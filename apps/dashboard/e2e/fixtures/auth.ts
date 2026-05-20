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

import { expect, type Page } from "@playwright/test"
import {
  expectAuthenticatedShell,
  expectCurrentPath,
  expectNoAppCrash,
  getUserMenuTrigger,
} from "./assertions"
import { TEST_TENANT } from "./tenant"

export type Persona = "admin" | "owner" | "receptionist" | "employee"

const LOGIN_FORM_TIMEOUT_MS = 10_000

/**
 * Credentials keyed by persona.
 *
 * - admin / owner: resolved from TEST_TENANT; owner aliases the seeded admin
 *   by default unless SEED_OWNER_* overrides point at a distinct seeded owner.
 * - receptionist / employee: default seeded personas with env var overrides
 *   for CI or custom seed fixtures.
 */
export const PERSONA_CREDENTIALS: Record<
  Persona,
  { email: string; password: string }
> = {
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
    email: process.env.SEED_RECEPTIONIST_EMAIL ?? "receptionist@sawaa-test.com",
    password: process.env.SEED_RECEPTIONIST_PASSWORD ?? "Recept@1234",
  },
  employee: {
    email: process.env.SEED_EMPLOYEE_EMAIL ?? "employee@sawaa-test.com",
    password: process.env.SEED_EMPLOYEE_PASSWORD ?? "Employee@1234",
  },
}

/**
 * Log in as a given persona by filling the login form.
 *
 * ⚠️  Prefer `test.use({ storageState: storageStatePath('admin') })` in spec files
 *    so Playwright reuses a pre-authenticated context.  Only call `loginAs` when
 *    you need a *different* persona mid-test or when the setup state is stale.
 */
export async function loginAs(
  page: Page,
  persona: Persona = "admin"
): Promise<void> {
  const { email, password } = PERSONA_CREDENTIALS[persona]

  await page.goto("/login", { waitUntil: "domcontentloaded" })

  const loginIdentifier = page.locator("#identifier")

  if (!isLoginPath(page.url())) {
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
    return
  }

  const loginEntryState = await Promise.race([
    page
      .waitForURL((url) => !isLoginPath(url.toString()), {
        timeout: LOGIN_FORM_TIMEOUT_MS,
      })
      .then(() => "redirected" as const)
      .catch(() => "timeout" as const),
    loginIdentifier
      .waitFor({ state: "visible", timeout: LOGIN_FORM_TIMEOUT_MS })
      .then(() => "form-visible" as const)
      .catch(() => "timeout" as const),
  ])

  if (loginEntryState === "redirected" || !isLoginPath(page.url())) {
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
    return
  }

  if (loginEntryState !== "form-visible") {
    await expect(
      loginIdentifier,
      `Login form did not become visible within ${LOGIN_FORM_TIMEOUT_MS}ms while the page remained on ${page.url()}. ` +
        "Refusing to treat a hidden #identifier field as an authenticated session."
    ).toBeVisible({ timeout: 0 })
  }

  // Multi-step login wizard
  await expectCurrentPath(page, "/login")
  await expect(loginIdentifier).toBeVisible()
  await loginIdentifier.fill(email)

  const continueButton = page.getByRole("button", { name: "متابعة" })
  await expect(continueButton).toBeEnabled()
  await continueButton.click()

  const passwordMethodButton = page.getByRole("button", {
    name: "باستخدام كلمة المرور",
  })
  await expect(passwordMethodButton).toBeEnabled()
  await passwordMethodButton.click()

  await page.locator("#password").fill(password)
  const submitButton = page.getByRole("button", { name: "تسجيل الدخول" })
  await expect(submitButton).toBeEnabled()
  await submitButton.click()

  await expectAuthenticatedShell(page)
  await expect(loginIdentifier).not.toBeVisible({ timeout: 5_000 })
  await expectNoAppCrash(page)
}

/**
 * Log out the current user via the authenticated shell user menu.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto("/")
  await expectAuthenticatedShell(page)

  const userButton = getUserMenuTrigger(page)
  await expect(userButton).toBeVisible()
  await userButton.click()

  const logoutButton = page.getByRole("button", {
    name: /logout|تسجيل الخروج|Sign Out/i,
  })
  await expect(logoutButton).toBeVisible()
  await logoutButton.click()
  await expectCurrentPath(page, "/login")
}

/**
 * Path to the Playwright storageState file for a persona.
 *
 * Usage in a spec file:
 *   test.use({ storageState: storageStatePath('admin') });
 */
export function storageStatePath(persona: Persona): string {
  return `playwright/.auth/${persona}.json`
}

/**
 * Return the raw credentials for a persona (useful for API-level auth in
 * seed helpers that need a token outside of a browser context).
 */
export function getPersonaCredentials(persona: Persona): {
  email: string
  password: string
} {
  return PERSONA_CREDENTIALS[persona]
}

function isLoginPath(url: string): boolean {
  return new URL(url).pathname === "/login"
}
