/**
 * dashboard-by-role.spec.ts
 *
 * Smoke coverage for the role-based dashboard home (Plan
 * `2026-05-06-dashboard-role-based-home.md`, Task 10).
 *
 * Asserts that role-gated widgets on `/` render (or don't) according to
 * the active membership role.
 *
 * The shared auth fixture uses the same default personas as
 * apps/backend/prisma/seed.ts: admin/owner alias, receptionist, and employee.
 */
import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import {
  expectAuthenticatedShell,
  expectCurrentPath,
  expectNoAppCrash,
} from "../fixtures/assertions"
import { loginAs, storageStatePath } from "../fixtures/auth"

const DASHBOARD_ROOT = path.join(__dirname, "..", "..")
const BASE_URL = process.env.PW_DASHBOARD_URL ?? "http://localhost:5203"
const EMPLOYEE_STORAGE_STATE = path.join(
  DASHBOARD_ROOT,
  storageStatePath("employee")
)

test.describe("Dashboard home — role-based widgets", () => {
  test("ADMIN sees QuickActions", async ({ page }) => {
    await loginAs(page, "admin")
    await expectCurrentPath(page, "/")
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
    await expect(page.getByTestId("quick-actions")).toBeVisible()
  })

  test("OWNER alias sees QuickActions", async ({ page }) => {
    await loginAs(page, "owner")
    await expectCurrentPath(page, "/")
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
    await expect(page.getByTestId("quick-actions")).toBeVisible()
  })

  test("RECEPTIONIST sees QuickActions from seeded defaults", async ({
    page,
  }) => {
    await loginAs(page, "receptionist")
    await expectCurrentPath(page, "/")
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
    await expect(page.getByTestId("quick-actions")).toBeVisible()
  })

  test("EMPLOYEE sees no QuickActions when optional auth is available", async ({
    browser,
  }) => {
    test.skip(
      !fs.existsSync(EMPLOYEE_STORAGE_STATE),
      `Employee auth state was not generated at ${EMPLOYEE_STORAGE_STATE}; optional employee login likely is unavailable in this environment.`
    )

    const context = await browser.newContext({
      baseURL: BASE_URL,
      locale: "ar-SA",
      storageState: EMPLOYEE_STORAGE_STATE,
    })
    const page = await context.newPage()

    try {
      await page.goto("/", { waitUntil: "domcontentloaded" })
      await expectCurrentPath(page, "/")
      await expectAuthenticatedShell(page)
      await expectNoAppCrash(page)
      await expect(page.getByTestId("quick-actions")).toHaveCount(0)
    } finally {
      await context.close()
    }
  })
})
