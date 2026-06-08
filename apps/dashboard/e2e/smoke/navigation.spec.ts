import { test, expect } from "@playwright/test"
import {
  expectAuthenticatedShell,
  expectCurrentPath,
  expectNoAppCrash,
  getUserMenuTrigger,
} from "../fixtures/assertions"
import { loginAs } from "../fixtures/auth"

const DASHBOARD_PAGES = [
  {
    path: "/",
    name: "Dashboard Home",
    heading: /صباح الخير|مساء الخير|مساء النور|مرحباً|Good/i,
  },
  { path: "/bookings", name: "Bookings", heading: /الحجوزات|Bookings/i },
  { path: "/clients", name: "Clients", heading: /المستفيدين|Clients/i },
  { path: "/employees", name: "Employees", heading: /الممارسون|Employees/i },
  { path: "/users", name: "Users", heading: /المستخدمون|Users/i },
  { path: "/services", name: "Services", heading: /الخدمات|Services/i },
  { path: "/categories", name: "Categories", heading: /العيادات|Categories/i },
  {
    path: "/departments",
    name: "Departments",
    heading: /الأقسام|العيادات|Departments/i,
  },
  { path: "/payments", name: "Payments", heading: /المدفوعات|Payments/i },
  { path: "/invoices", name: "Invoices", heading: /الفواتير|Invoices/i },
  {
    path: "/ratings",
    name: "Ratings",
    heading: /تقييمات الممارسين|تقييمات|Ratings/i,
  },
  {
    path: "/contact-messages",
    name: "Contact Messages",
    heading: /رسائل التواصل|Contact Messages/i,
  },
  {
    path: "/notifications",
    name: "Notifications",
    heading: /الإشعارات|Notifications/i,
  },
]

test.describe("Dashboard Pages Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  for (const pageInfo of DASHBOARD_PAGES) {
    test(`should load ${pageInfo.name} (${pageInfo.path}) without crash`, async ({
      page,
    }) => {
      await page.goto(pageInfo.path, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      })
      await expectCurrentPath(page, pageInfo.path)
      await expectAuthenticatedShell(page)
      await expectNoAppCrash(page)
      await expect(
        page.getByRole("heading", { name: pageInfo.heading }).first()
      ).toBeVisible()
    })
  }

  test("should display authenticated shell with user menu", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)

    const userMenuTrigger = getUserMenuTrigger(page)
    await expect(userMenuTrigger).toBeVisible({ timeout: 5000 })
    await userMenuTrigger.click()

    await expect(
      page.getByRole("link", { name: /ملفي|My Profile/i })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /تسجيل الخروج|Sign Out/i })
    ).toBeVisible()
  })

  test("should highlight active sidebar item", async ({ page }) => {
    await page.goto("/bookings", { waitUntil: "domcontentloaded" })
    await expectCurrentPath(page, "/bookings")
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)

    const bookingsNavItem = page
      .getByRole("button", { name: /الحجوزات|Bookings/i })
      .first()
    await expect(bookingsNavItem).toBeVisible()
    await expect(bookingsNavItem).toHaveClass(/sidebar-active/)
  })

  test("should navigate via sidebar links", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await expectAuthenticatedShell(page)
    await expectNoAppCrash(page)

    const bookingsNavItem = page
      .getByRole("button", { name: /الحجوزات|Bookings/i })
      .first()
    await expect(bookingsNavItem).toBeVisible()
    await bookingsNavItem.click()

    await expectCurrentPath(page, "/bookings")
    await expect(
      page.getByRole("heading", { name: /الحجوزات|Bookings/i }).first()
    ).toBeVisible()
    await expectNoAppCrash(page)
  })
})
