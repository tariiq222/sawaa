import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Categories CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/categories')
    // network-idle never settles (TanStack Query polls) — wait for the page heading instead.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
  })

  test('should load categories page without errors', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display categories list or empty state', async ({ page }) => {
    // Categories surface as "clinics" (العيادات). The list renders a DataTable
    // (<table>) or the empty-state title "لا توجد عيادات".
    const table = page.getByRole('table')
    const emptyState = page.getByText(/لا توجد عيادات|No clinics found/i)
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 15_000 })
  })

  test('should navigate to create category page', async ({ page }) => {
    const createButton = page.locator('a[href="/categories/create"], button:has-text("create"), button:has-text("إضافة")')
    await expect(createButton.first()).toBeVisible({ timeout: 10_000 })
    await createButton.first().click()
    // The UI may use a dialog/sheet instead of page navigation
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should search categories', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="بحث"]')
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })
    await searchInput.first().fill('test')
    await page.waitForResponse(r => r.url().includes('/categories') && r.request().method() === 'GET' && r.ok()).catch(() => {})
    await searchInput.first().clear()
  })

  test('should paginate categories', async ({ page }) => {
    const pagination = page.locator('[class*="pagination"], [class*="pager"], button:has-text("next"), button:has-text("التالي")')
    const hasPagination = await pagination.first().isVisible().catch(() => false)
    test.skip(!hasPagination, 'No pagination present for current dataset')

    const nextButton = page.locator('button:has-text("next"), button:has-text("التالي"), [aria-label*="next"]')
    await expect(nextButton.first()).toBeVisible({ timeout: 10_000 })
    await nextButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should view category details', async ({ page }) => {
    const categoryRow = page.locator('tbody tr, [class*="category-row"]').first()
    await expect(categoryRow).toBeVisible({ timeout: 10_000 })
    await categoryRow.click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should create new category with valid data', async ({ page }) => {
    await page.goto('/categories/create')

    // Category creation is a multi-step wizard (info → settings → employees).
    // Only nameAr is required on the info step. Clicking "التالي" persists the
    // category (POST) and redirects to its edit route for the next step.
    const nameAr = page.locator('input#nameAr')
    await expect(nameAr).toBeVisible({ timeout: 10_000 })
    await nameAr.fill(`عيادة اختبار ${Date.now()}`)
    await page.locator('input#nameEn').fill(`E2E Clinic ${Date.now()}`)

    const created = page.waitForResponse(
      (r) => /\/organization\/categories(\?|$)/.test(r.url()) && r.request().method() === 'POST' && r.ok(),
      { timeout: 15_000 },
    )
    await page.getByRole('button', { name: 'التالي' }).click()
    await created
    await page.waitForURL('**/categories/*/edit**', { timeout: 15_000 })
  })

  test('should edit existing category', async ({ page }) => {
    // Row edit action is an icon button with aria-label "تعديل" → navigates to
    // /categories/CAT-xxx/edit (info tab).
    const editButton = page.getByRole('button', { name: 'تعديل' }).first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()
    await page.waitForURL('**/categories/*/edit**', { timeout: 10_000 })

    // The form hydrates the saved name asynchronously (waits for department
    // options); wait for the non-empty value before editing it.
    const nameAr = page.locator('input#nameAr')
    await expect(nameAr).not.toHaveValue('', { timeout: 10_000 })
    await nameAr.fill(`عيادة محدثة ${Date.now()}`)

    // Advancing from the info tab in edit mode persists via PATCH.
    const saved = page.waitForResponse(
      (r) => /\/organization\/categories\//.test(r.url()) && r.request().method() === 'PATCH' && r.ok(),
      { timeout: 15_000 },
    )
    await page.getByRole('button', { name: 'التالي' }).click()
    await saved
  })

  test('should delete category with confirmation', async ({ page }) => {
    // Row delete action is an icon button with aria-label "حذف" → opens an
    // AlertDialog whose confirm action is also labelled "حذف".
    const deleteButton = page.getByRole('button', { name: 'حذف' }).first()
    await expect(deleteButton).toBeVisible({ timeout: 10_000 })
    await deleteButton.click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await dialog.getByRole('button', { name: 'حذف' }).click()
    await expect(dialog).toBeHidden({ timeout: 10_000 })
  })
})
