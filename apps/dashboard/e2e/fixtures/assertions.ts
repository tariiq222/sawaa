import { expect, type Page } from "@playwright/test"

/**
 * Assert that the authenticated dashboard chrome rendered instead of a
 * false-positive blank page or redirected login screen.
 *
 * Tolerates the transient loading states (AuthGate spinner + route-segment
 * `loading.tsx` "جارٍ التحميل...") by waiting for them to clear first. Under a
 * cold dev server compiling routes in parallel, the segment can stream slower
 * than a flat 15s — wait it out rather than flaking.
 */
export async function expectAuthenticatedShell(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 15_000 })
  // Let any loading placeholder resolve before asserting the shell.
  await expect(page.getByText(/^جارٍ التحميل\.\.\.$/))
    .toHaveCount(0, { timeout: 30_000 })
    .catch(() => {})
  await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 })
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
  // The route-level error boundary (app/(dashboard)/error.tsx) renders a bare
  // "حدث خطأ" heading plus the raw error.message — which the fallback text
  // above does NOT cover when a message is present. Match the boundary heading
  // exactly (role=heading) so it can't false-positive on inline body copy.
  await expect(
    page.getByRole("heading", { name: /^حدث خطأ$/ })
  ).toHaveCount(0)
}

/** Assert the current URL pathname without coupling tests to host/query params. */
export async function expectCurrentPath(
  page: Page,
  path: string
): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path)
}

/**
 * Build a strict text matcher for the dashboard's canonical money display:
 * integer halalas rendered as SAR-major units with two decimals.
 */
export function sarAmountPattern(halalas: number): RegExp {
  const sar = halalas / 100
  const en = sar.toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const ar = sar.toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return new RegExp(`${escapeRegex(en)}|${escapeRegex(ar)}`)
}

/**
 * Match the forbidden raw integer-halala display in either English or Arabic
 * numerals, with grouped whole numbers and grouped two-decimal variants.
 */
export function rawHalalasPattern(halalas: number): RegExp {
  const values = new Set([
    String(halalas),
    halalas.toFixed(2),
    halalas.toLocaleString("en", { maximumFractionDigits: 0 }),
    halalas.toLocaleString("en", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    halalas.toLocaleString("ar-SA", {
      maximumFractionDigits: 0,
      useGrouping: false,
    }),
    halalas.toLocaleString("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    }),
    halalas.toLocaleString("ar-SA", { maximumFractionDigits: 0 }),
    halalas.toLocaleString("ar-SA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  ])

  return new RegExp(Array.from(values).map(escapeRegex).join("|"))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
