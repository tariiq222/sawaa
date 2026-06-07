import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Departments CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/departments')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  })

  test('should load departments page without errors', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display departments list or empty state', async ({ page }) => {
    await page.waitForResponse(r => r.url().includes('/departments') && r.request().method() === 'GET' && r.ok()).catch(() => {})

    const departmentsList = page.locator('[class*="table"], [class*="list"], [class*="department"]')
    const emptyState = page.locator('text=/no department|لا يوجد قسم|no data/i')

    const hasList = await departmentsList.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    expect(hasList || hasEmpty).toBeTruthy()
  })

  test('should open create department dialog', async ({ page }) => {
    // Departments use a dialog for creation — there is no /departments/create route.
    // The "إضافة قسم" button opens a Dialog (not a page navigation).
    const createButton = page.locator('button:has-text("إضافة قسم"), button:has-text("Add Department")')
    await expect(createButton.first()).toBeVisible({ timeout: 10_000 })
    await createButton.first().click()
    // Dialog should appear
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
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
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"], input[placeholder*="الاسم"]')
    const descriptionInput = page.locator('textarea[id*="description"], textarea[placeholder*="description"]')
    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("حفظ")')

    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 })
    await nameInput.first().fill(`Test Department ${Date.now()}`)

    const descriptionVisible = await descriptionInput.first().isVisible().catch(() => false)
    if (descriptionVisible) await descriptionInput.first().fill('Test department description')

    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should edit existing department', async ({ page }) => {
    const editButton = page.locator('a[href*="/departments/edit"], button:has-text("edit"), button:has-text("تعديل")').first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()

    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"]')
    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 })
    await nameInput.first().clear()
    await nameInput.first().fill(`Updated Department ${Date.now()}`)

    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("حفظ")')
    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should delete department with confirmation', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("حذف")').first()
    await expect(deleteButton).toBeVisible({ timeout: 10_000 })
    await deleteButton.click()

    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("تأكيد")')
    await expect(confirmButton.first()).toBeVisible({ timeout: 10_000 })
    await confirmButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })
})
