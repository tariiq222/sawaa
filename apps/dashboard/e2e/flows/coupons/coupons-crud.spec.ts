/**
 * coupons-crud.spec.ts
 *
 * E2E: admin manages coupons (create → list → edit → delete) through the
 * dashboard UI at /coupons.
 *
 * Strategy: seed a coupon in beforeAll via the API so the list is guaranteed
 * to have at least one row, enabling edit/delete actions to be exercised.
 * The create-coupon test POSTs through the UI form, and cleanup in afterAll
 * removes the seeded coupon regardless of test outcome.
 *
 * Requires: backend on :5200, dashboard on :5203, seeded admin user.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from '../../fixtures/auth'
import { getTestTenant } from '../../fixtures/tenant'
import {
  seedCoupon,
  cleanupCoupon,
  type SeededCoupon,
} from '../../fixtures/seed'

let token = ''
let seededCoupon: SeededCoupon

test.beforeAll(async ({ browser }) => {
  const organization = await getTestTenant()
  token = organization.accessToken
  seededCoupon = await seedCoupon(token, {
    discountType: 'PERCENTAGE',
    discountValue: 15,
    descriptionAr: 'كوبون اختبار آلي',
    descriptionEn: 'E2E test coupon',
    isActive: true,
  })

  // Warm the dashboard route table before tests start so loginAs's
  // `expectAuthenticatedShell(<main>)` (30s timeout) doesn't trip on cold
  // Turbopack compiles of the coupons layout + form routes.
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await loginAs(page, 'admin')
    await page.goto('/coupons', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 60_000 })
    await page.goto('/coupons/create', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 60_000 })
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  if (seededCoupon?.id) {
    await cleanupCoupon(seededCoupon.id, token).catch(() => undefined)
  }
})

test.describe('Coupons CRUD Operations', () => {
  // Cold dev-server compiles can push loginAs's `expectAuthenticatedShell`
  // (which waits up to 30s for `main`) past its timeout in local runs. CI
  // uses a pre-built dashboard so this is rarely hit there.
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/coupons')
    // The coupons list GET resolves before the table renders; wait for the
    // unique coupon code seeded in beforeAll to appear in the list.
    await expect(page.getByText(seededCoupon.code).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('should load coupons page and display the seeded coupon', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /الكوبونات|Coupons/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
    // The seeded coupon code is rendered inside the data table.
    await expect(page.getByText(seededCoupon.code).first()).toBeVisible()
    // Discount rendered as "15%" because we created a PERCENTAGE coupon.
    await expect(page.getByText('15%').first()).toBeVisible()
  })

  test('should create a coupon through the UI form', async ({ page }) => {
    const suffix = Date.now()
    const code = `UI${suffix}`.slice(0, 12)
    await page.goto('/coupons/create')

    // Coupon form: code + discountType (Select) + discountValue + optional fields.
    await page.locator('input[name="code"]').fill(code)
    await page.locator('input[name="discountValue"]').fill('25')
    await page.locator('input[name="descriptionEn"]').fill('UI-created test coupon')
    await page.locator('input[name="descriptionAr"]').fill('كوبون اختبار من الواجهة')

    const submitButton = page.locator('form button[type="submit"]')
    await expect(submitButton).toBeVisible({ timeout: 10_000 })

    // Wait for the POST that the click fires, then for the redirect. Both are
    // real outcomes of the create flow.
    const postPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/dashboard/finance/coupons') &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 15_000 },
    )
    await submitButton.click()
    const postRes = await postPromise
    expect(postRes.status()).toBe(201)

    await page.waitForURL('/coupons', { timeout: 15_000 })
    await expect(page.getByText(code).first()).toBeVisible({ timeout: 15_000 })

    // Clean up the UI-created coupon through the API so the suite is idempotent.
    const res = await fetch(
      `http://localhost:5200/api/v1/dashboard/finance/coupons?search=${encodeURIComponent(code)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.ok) {
      const body = (await res.json()) as {
        items?: Array<{ id: string; code: string }>
      }
      const found = body.items?.find((c) => c.code === code)
      if (found) {
        await cleanupCoupon(found.id, token).catch(() => undefined)
      }
    }
  })

  test('should open the edit page for the seeded coupon and update the discount via the UI', async ({
    page,
  }) => {
    // Open the row actions menu — the actions column exposes a "..." dropdown
    // whose accessible name comes from the sr-only span (Actions / إجراءات).
    const row = page.locator('tr', { hasText: seededCoupon.code }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })

    const actionsTrigger = row
      .getByRole('button', { name: /Actions|إجراءات/ })
      .last()
    await actionsTrigger.click()
    const editItem = page.getByRole('menuitem', {
      name: /^تعديل$|^Edit$/,
    })
    await expect(editItem).toBeVisible({ timeout: 5_000 })
    await editItem.click()

    // Edit page is /coupons/<ref>/edit.
    await page.waitForURL(/\/coupons\/[^/]+\/edit$/, { timeout: 15_000 })
    // The code input is disabled on edit (code is immutable) and pre-filled.
    const codeInput = page.locator('input[name="code"]')
    await expect(codeInput).toBeDisabled()
    await expect(codeInput).toHaveValue(seededCoupon.code)

    // Bump discountValue from 15 → 20 and capture the PATCH that fires.
    const discountValue = page.locator('input[name="discountValue"]')
    await expect(discountValue).toBeVisible({ timeout: 10_000 })
    await discountValue.fill('20')

    const submitButton = page.locator('form button[type="submit"]')
    const patchPromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/dashboard/finance/coupons/${seededCoupon.id}`) &&
        r.request().method() === 'PATCH' &&
        r.ok(),
      { timeout: 15_000 },
    )
    await submitButton.click()
    const patchRes = await patchPromise
    expect(patchRes.status()).toBe(200)

    await page.waitForURL('/coupons', { timeout: 15_000 })

    // Confirm at the API level that the seed coupon's discountValue is now 20.
    // Reading via the detail endpoint avoids coupling to client-side refetch
    // timing (TanStack Query invalidation runs async after the redirect).
    // The backend serialises numbers as strings for Prisma Decimal columns,
    // so coerce before comparing.
    const detailRes = await fetch(
      `http://localhost:5200/api/v1/dashboard/finance/coupons/${seededCoupon.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(detailRes.ok).toBeTruthy()
    const detail = (await detailRes.json()) as { discountValue: number | string }
    expect(Number(detail.discountValue)).toBe(20)

    // Restore the original discount value via the API so the seeded assertion
    // in the next runs remains valid (seededCoupon.discountValue = 15).
    const restoreRes = await fetch(
      `http://localhost:5200/api/v1/dashboard/finance/coupons/${seededCoupon.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ discountValue: 15 }),
      },
    )
    if (!restoreRes.ok) {
      throw new Error(
        `[e2e/coupons] failed to restore discountValue: HTTP ${restoreRes.status}`,
      )
    }
  })

  test('should delete a coupon through the actions menu', async ({ page }) => {
    // Re-seed a coupon dedicated to this test so we never delete the row that
    // other tests rely on.
    const disposable = await seedCoupon(token, {
      discountType: 'FIXED',
      discountValue: 5000, // 50 SAR in halalas
    })

    // Reload to ensure the new row is fetched by the list query.
    await page.goto('/coupons')
    await expect(page.getByText(disposable.code).first()).toBeVisible({
      timeout: 15_000,
    })

    const row = page.locator('tr', { hasText: disposable.code }).first()
    const actionsTrigger = row
      .getByRole('button', { name: /Actions|إجراءات/ })
      .last()
    await actionsTrigger.click()
    const deleteItem = page.getByRole('menuitem', {
      name: /^حذف$|^Delete$/,
    })
    await expect(deleteItem).toBeVisible({ timeout: 5_000 })
    await deleteItem.click()

    // AlertDialog renders with role="alertdialog" and destructive action button.
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    const confirmButton = dialog.locator('button', { hasText: /^حذف$|^Delete$/ })
    const deletePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/dashboard/finance/coupons/${disposable.id}`) &&
        r.request().method() === 'DELETE' &&
        r.ok(),
      { timeout: 15_000 },
    )
    await confirmButton.click()
    const deleteRes = await deletePromise
    expect(deleteRes.status()).toBe(204)

    // The dialog closes and the row disappears from the list.
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    await expect(page.getByText(disposable.code)).toHaveCount(0, {
      timeout: 15_000,
    })

    // Belt-and-braces: confirm at the API level too. cleanupCoupon is a no-op
    // when the row is already gone (DELETE returns 404 → swallowed).
    await cleanupCoupon(disposable.id, token).catch(() => undefined)
  })
})
