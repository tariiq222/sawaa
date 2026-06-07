/**
 * home-dashboard-render.spec.ts
 *
 * Regression for the home dashboard (`/`) rendering past HTTP 200.
 *
 * Why this exists: the route returns 200 even when the client tree throws
 * (an error boundary replaces the page). A prior incident — a removed
 * top-performers widget surviving in a stale client bundle — surfaced
 * `Failed to parse src "<key>" on next/image` and crashed the whole page
 * while `smoke.spec.ts` (status===200 + body visible) stayed green.
 *
 * This test asserts the *actual dashboard content* renders and that no
 * error boundary / next/image failure is present.
 *
 * Requires: backend on :5200, dashboard on :5203, seeded admin.
 */

import { test, expect } from "@playwright/test"
import { loginAs } from "../fixtures/auth"
import { expectAuthenticatedShell, expectNoAppCrash } from "../fixtures/assertions"

test.describe("home dashboard render", () => {
  test("renders KPI content, not an error boundary", async ({ page }) => {
    const consoleErrors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text())
    })

    await loginAs(page, "admin")
    await page.goto("/", { waitUntil: "domcontentloaded" })

    // Authenticated shell (sidebar brand + main) is present.
    await expectAuthenticatedShell(page)

    // No Next.js error overlay or app-level crash boundary.
    await expectNoAppCrash(page)

    // The bare Arabic error-boundary heading must NOT be the page content.
    // (expectNoAppCrash only matches the longer "حدث خطأ غير متوقع" copy; the
    // route-level boundary renders a bare "حدث خطأ", so assert it explicitly.)
    await expect(
      page.getByRole("heading", { name: /^حدث خطأ$/ }),
    ).toHaveCount(0)

    // Actual dashboard content rendered: the greeting and at least one stat.
    await expect(
      page.getByText(/صباح الخير|مساء الخير|أهلاً|مرحباً/),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId("dashboard-stats")).toBeVisible({
      timeout: 15_000,
    })

    // Guard against the specific failure mode: a raw image key in next/image.
    const imageKeyError = consoleErrors.find(
      (t) =>
        /Failed to parse src/.test(t) ||
        /Failed to construct 'URL'/.test(t),
    )
    expect(
      imageKeyError,
      `next/image received an unresolved src:\n${imageKeyError ?? ""}`,
    ).toBeUndefined()
  })

  test("home stays rendered after a reload (no stale-bundle crash)", async ({
    page,
  }) => {
    await loginAs(page, "admin")
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expect(page.getByTestId("dashboard-stats")).toBeVisible({
      timeout: 15_000,
    })

    await page.reload({ waitUntil: "domcontentloaded" })
    await expectNoAppCrash(page)
    await expect(
      page.getByRole("heading", { name: /^حدث خطأ$/ }),
    ).toHaveCount(0)
    await expect(page.getByTestId("dashboard-stats")).toBeVisible({
      timeout: 15_000,
    })
  })
})
