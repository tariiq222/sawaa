import { expect, type Page } from "@playwright/test"

/**
 * Assert that the authenticated dashboard chrome rendered instead of a
 * false-positive blank page or redirected login screen.
 */
export async function expectAuthenticatedShell(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 })
  await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 })
  await expect(getDashboardBrand(page)).toBeVisible({
    timeout: 10_000,
  })
}

/** Locate the Sawa brand in the authenticated sidebar/shell. */
export function getDashboardBrand(page: Page) {
  return page
    .getByRole("link", { name: /سواء|Sawa{1,2}/i })
    .or(page.getByText(/سواء|Sawa{1,2}/i))
    .first()
}

/** Locate the visible authenticated user-menu trigger without assuming a header tag. */
export function getUserMenuTrigger(page: Page) {
  return page
    .getByRole("button", {
      name: /قائمة المستخدم|User menu|الحساب|Account|Profile|مدير العيادة|Clinic Manager|admin@sawaa-test\.com|receptionist@sawaa-test\.com|employee@sawaa-test\.com|موظف(?:ة)? استقبال|Receptionist|Employee|Admin|Owner|Doctor|Manager|محاسب|مالك|مدير|طبيب/i,
    })
    .last()
}

/** Assert that the route has no global/Next.js crash boundary visible. */
export async function expectNoAppCrash(page: Page): Promise<void> {
  await expect(page.locator("[data-nextjs-error]")).toHaveCount(0)
  await expect(
    page.getByText(
      /حدث خطأ غير متوقع|نعتذر، حدث خطأ في النظام|Application error|Unhandled Runtime Error|Something went wrong/i
    )
  ).toHaveCount(0)
}

/** Assert the current URL pathname without coupling tests to host/query params. */
export async function expectCurrentPath(
  page: Page,
  path: string
): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path)
}
