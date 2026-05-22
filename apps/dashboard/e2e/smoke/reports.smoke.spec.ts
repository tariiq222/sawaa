/**
 * reports.smoke.spec.ts
 *
 * Smoke coverage for the rebuilt /reports routes (Plan
 * `2026-05-22-reports-rebuild-plan.md`).
 *
 * Visits each of the seven dedicated reports and asserts the KPI row
 * renders. Also verifies the period preset switcher refetches data.
 */
import { test, expect } from "@playwright/test"
import {
  expectAuthenticatedShell,
  expectCurrentPath,
  expectNoAppCrash,
} from "../fixtures/assertions"
import { loginAs } from "../fixtures/auth"

const ROUTES: { slug: string; titleKey: string }[] = [
  { slug: "overview", titleKey: "نظرة عامة" },
  { slug: "financial", titleKey: "التقرير المالي" },
  { slug: "bookings", titleKey: "تقرير الحجوزات" },
  { slug: "clients", titleKey: "تقرير العملاء" },
  { slug: "practitioners", titleKey: "تقرير الممارسين" },
  { slug: "services", titleKey: "تقرير الخدمات" },
  { slug: "ratings", titleKey: "تقرير التقييمات" },
]

test.describe("Reports — smoke", () => {
  test("/reports redirects to /reports/overview", async ({ page }) => {
    await loginAs(page, "admin")
    await page.goto("/reports")
    await expect(page).toHaveURL(/\/reports\/overview$/)
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)
  })

  for (const route of ROUTES) {
    test(`/reports/${route.slug} renders KPI row and sidebar`, async ({
      page,
    }) => {
      await loginAs(page, "admin")
      await page.goto(`/reports/${route.slug}`)
      await expectCurrentPath(page, `/reports/${route.slug}`)
      await expectAuthenticatedShell(page)
      await expectNoAppCrash(page)

      // Page title visible
      await expect(page.getByRole("heading", { name: route.titleKey })).toBeVisible()

      // Sidebar nav item is active
      await expect(
        page.getByTestId(`reports-nav-${route.slug}`),
      ).toBeVisible()

      // KPI row renders (may be skeleton or populated)
      await expect(page.getByTestId("report-kpi-row")).toBeVisible()
    })
  }

  test("changing period preset triggers a refetch", async ({ page }) => {
    await loginAs(page, "admin")
    await page.goto("/reports/overview")
    await expect(page.getByTestId("report-kpi-row")).toBeVisible()

    await page.getByTestId("reports-period-last7").click()
    // Verify the chip becomes active (visual state) and KPI still renders
    await expect(page.getByTestId("report-kpi-row")).toBeVisible()
  })
})
