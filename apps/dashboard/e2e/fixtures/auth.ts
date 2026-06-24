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

const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"
const DASHBOARD_BASE = process.env.PW_DASHBOARD_URL ?? "http://localhost:5203"

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
  const data = await apiLogin(persona)
  const dashboardUrl = new URL(DASHBOARD_BASE)
  await page.context().addCookies([
    {
      name: "ck_refresh",
      value: data.refreshToken,
      domain: dashboardUrl.hostname,
      path: "/",
      expires: -1,
      httpOnly: true,
      secure: dashboardUrl.protocol === "https:",
      sameSite: "Lax",
    },
  ])

  // Seed the localStorage hydration hint BEFORE the first navigation so the
  // dashboard boots authenticated in a SINGLE page load.
  //
  // Why this matters (root cause of the `main` not-visible flake): the backend
  // ROTATES the refresh token on every /auth/refresh — it revokes the presented
  // token and issues a new one via Set-Cookie. The old flow did
  // goto("/") → setLocalStorage → reload(), which fired TWO refreshes back to
  // back. The reload aborted the first refresh in-flight, so the browser never
  // stored the rotated cookie (Set-Cookie) and replayed the ORIGINAL token on
  // the second refresh — which the backend had already revoked → 401 → AuthGate
  // bounces to the login screen and `main` never renders. `sawaa_user` is only a
  // non-PII hydration hint (the canonical auth path is the ck_refresh cookie →
  // refresh → /me), so seeding it via an init script before a single load is
  // behaviourally identical, minus the rotation race.
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem("sawaa_user", JSON.stringify({
        id: user.id,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      }))
      localStorage.setItem("sawaa-locale", "ar")
    },
    { user: data.user }
  )

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expectAuthenticatedShell(page)
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

interface SessionUser {
  id: string
  role: string
  isSuperAdmin?: boolean
}

interface ApiLoginResponse {
  accessToken: string
  refreshToken?: string
  user: SessionUser
}

async function apiLogin(persona: Persona): Promise<{
  accessToken: string
  refreshToken: string
  user: SessionUser
}> {
  const { email, password } = PERSONA_CREDENTIALS[persona]
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)")
    throw new Error(
      `[e2e/auth] API login failed for ${persona} (${email}) — HTTP ${res.status}: ${body}`
    )
  }

  const data = (await res.json()) as ApiLoginResponse
  const refreshToken = data.refreshToken ?? parseRefreshCookie(res.headers.get("set-cookie"))
  if (!data.accessToken || !refreshToken || !data.user) {
    throw new Error(
      `[e2e/auth] API login response missing token/user for ${persona}`
    )
  }
  return { accessToken: data.accessToken, refreshToken, user: data.user }
}

function parseRefreshCookie(setCookie: string | null): string | null {
  if (!setCookie) return null
  const match = /(?:^|;\s*)ck_refresh=([^;]+)/.exec(setCookie)
  return match?.[1] ?? null
}
