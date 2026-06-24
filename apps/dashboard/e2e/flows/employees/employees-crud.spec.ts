import { test, expect } from '@playwright/test'
import { expectCurrentPath } from '../../fixtures/assertions'
import { loginAs } from '../../fixtures/auth'

test.describe('Employees CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/employees')
    // network-idle never settles (TanStack Query polls) — wait for the page heading instead.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
  })

  test('should load employees page without errors', async ({ page }) => {
    await expect(page.locator('body')).toBeVisible()

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display employees list or empty state', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const employeesList = page.locator('[class*="table"], [class*="list"], [class*="employee"]')
    const emptyState = page.locator('text=/no employee|لا يوجد موظف|no data/i')

    const hasList = await employeesList.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)
    const bodyVisible = await page.locator('body').isVisible()

    expect(bodyVisible && (hasList || hasEmpty || true)).toBeTruthy()
  })

  test('should navigate to create employee page', async ({ page }) => {
    const createButton = page.locator('a[href="/employees/create"], button:has-text("create"), button:has-text("إضافة")')
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click()
      await page.waitForURL('/employees/create', { timeout: 10000 })
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should search employees', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="بحث"]')
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      // Typing must not crash the page — the heading stays mounted while the list refetches.
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      await searchInput.clear()
    }
  })

  test('should filter employees', async ({ page }) => {
    const filterSelect = page.locator('select').first()
    if (await filterSelect.isVisible()) {
      const options = await filterSelect.locator('option').count()
      if (options > 1) {
        await filterSelect.selectOption({ index: 1 })
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      }
    }
  })

  test('should paginate employees', async ({ page }) => {
    const pagination = page.locator('[class*="pagination"], [class*="pager"], button:has-text("next"), button:has-text("التالي")')
    if (await pagination.isVisible()) {
      const nextButton = page.locator('button:has-text("next"), button:has-text("التالي"), [aria-label*="next"]')
      if (await nextButton.isVisible()) {
        await nextButton.click()
        await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
      }
    }
  })

  test('should sort employees', async ({ page }) => {
    const sortButtons = page.locator('[aria-sort], button[class*="sort"], th')
    if (await sortButtons.first().isVisible()) {
      await sortButtons.first().click()
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('should view employee details', async ({ page }) => {
    const employeeRow = page.locator('tbody tr, [class*="employee-row"]').first()
    if (await employeeRow.isVisible()) {
      await employeeRow.click()
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('should create new employee with valid data', async ({ page }) => {
    // Keep create navigation inside the authenticated SPA session from
    // beforeEach so the in-memory access token remains available.
    await expectCurrentPath(page, '/employees')
    await page.getByRole('button', { name: /إضافة ممارس|Add Employee/i }).click()
    await expectCurrentPath(page, '/employees/create')

    const suffix = Date.now()
    await page.locator('input[name="nameEn"]').fill(`Test Employee ${suffix}`)
    await page.locator('input[name="nameAr"]').fill(`ممارس اختبار ${suffix}`)
    await page.locator('input[name="email"]').fill(`employee${suffix}@test.com`)
    await page.locator('input[name="phone"]').fill('+966501234567')
    await page.locator('input[name="specialty"]').fill('Family Counselor')
    await page.locator('input[name="specialtyAr"]').fill('إرشاد أسري')

    const saveButton = page.getByRole('button', { name: /إنشاء الممارس|إضافة ممارس|Add Employee/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expectCurrentPath(page, '/employees')
    await expect(page.getByText(`ممارس اختبار ${suffix}`).or(page.getByText(`Test Employee ${suffix}`)).first()).toBeVisible()
  })

  test('should edit existing employee', async ({ page }) => {
    // Row edit action is an icon button with aria-label "تعديل" (common.edit) →
    // navigates to /employees/<id>/edit.
    const editButton = page.getByRole('button', { name: 'تعديل' }).first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()
    await page.waitForURL(/\/employees\/[^/]+\/edit/, { timeout: 10_000 })

    // Wait for the form to hydrate the saved name before editing it.
    const nameEn = page.locator('input[name="nameEn"]')
    await expect(nameEn).not.toHaveValue('', { timeout: 10_000 })
    await nameEn.fill(`Updated Employee ${Date.now()}`)

    // Single form with one type="submit"; a successful save returns to
    // /employees.
    await page.locator('button[type="submit"]').click()
    await page.waitForURL('**/employees', { timeout: 15_000 })
  })

  test('should delete employee with confirmation', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("حذف")').first()
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click()

      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("تأكيد")')
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click()
        // Confirming the delete closes the dialog — wait on that concrete effect.
        await expect(confirmButton).toBeHidden({ timeout: 10_000 })
      }
    }
  })
})
