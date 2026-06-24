import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Departments CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/departments')
    // network-idle never settles (TanStack Query polls) — wait for the page heading instead.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
  })

  test('should load departments page without errors', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display departments list or empty state', async ({ page }) => {
    // The real list renders a DataTable (<table>) or the empty-state title
    // "لا توجد أقسام" — assert on the actual rendered structure, not guessed
    // class fragments.
    const table = page.getByRole('table')
    const emptyState = page.getByText(/لا توجد أقسام|No departments/i)
    await expect(table.or(emptyState).first()).toBeVisible({ timeout: 15_000 })
  })

  test('should navigate to the create department page', async ({ page }) => {
    // Creation is a dedicated /departments/create route (PageHeader "إضافة قسم"
    // button → router.push), NOT a dialog. The empty-state can render a second
    // "إضافة قسم" action inside the table, so target the header button (first in
    // DOM) explicitly.
    await page.getByRole('button', { name: 'إضافة قسم' }).first().click()
    await page.waitForURL('**/departments/create', { timeout: 10_000 })
    await expect(page.locator('input[name="nameEn"]')).toBeVisible({ timeout: 10_000 })
  })

  test('should search departments', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="بحث"]')
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })
    await searchInput.first().fill('test')
    await page.waitForResponse(r => r.url().includes('/departments') && r.request().method() === 'GET' && r.ok()).catch(() => {})
    await searchInput.first().clear()
  })

  test('should paginate departments', async ({ page }) => {
    const pagination = page.locator('[class*="pagination"], [class*="pager"], button:has-text("next"), button:has-text("التالي")')
    const hasPagination = await pagination.first().isVisible().catch(() => false)
    test.skip(!hasPagination, 'No pagination present for current dataset')

    const nextButton = page.locator('button:has-text("next"), button:has-text("التالي"), [aria-label*="next"]')
    await expect(nextButton.first()).toBeVisible({ timeout: 10_000 })
    await nextButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should view department details', async ({ page }) => {
    const departmentRow = page.locator('tbody tr, [class*="department-row"]').first()
    await expect(departmentRow).toBeVisible({ timeout: 10_000 })
    await departmentRow.click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should create new department with valid data', async ({ page }) => {
    await page.goto('/departments/create')

    // Real form fields are register("nameAr"/"nameEn") → name="…", with no
    // id/placeholder. Both AR + EN names are required by the zod schema.
    const nameEn = page.locator('input[name="nameEn"]')
    const nameAr = page.locator('input[name="nameAr"]')
    await expect(nameEn).toBeVisible({ timeout: 10_000 })
    await nameEn.fill(`E2E Department ${Date.now()}`)
    await nameAr.fill(`قسم اختبار ${Date.now()}`)

    // The footer submit is the only type="submit" control on the form; its
    // visible label is theme/locale-dependent, so target it by type.
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/departments', { timeout: 15_000 })
    await expect(page.getByRole('table').or(page.getByText(/لا توجد أقسام/)).first())
      .toBeVisible({ timeout: 10_000 })
  })

  test('should edit existing department', async ({ page }) => {
    // Row edit action is an icon button with aria-label "تعديل" → navigates to
    // /departments/[id]/edit.
    const editButton = page.getByRole('button', { name: 'تعديل' }).first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()
    await page.waitForURL('**/departments/*/edit', { timeout: 10_000 })

    const nameEn = page.locator('input[name="nameEn"]')
    await expect(nameEn).toBeVisible({ timeout: 10_000 })
    await nameEn.fill(`Updated Department ${Date.now()}`)

    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/departments', { timeout: 15_000 })
  })

  test('should delete department with confirmation', async ({ page }) => {
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
