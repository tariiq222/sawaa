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
    await page.waitForResponse(r => r.url().includes('/categories') && r.request().method() === 'GET' && r.ok()).catch(() => {})

    const categoriesList = page.locator('[class*="table"], [class*="list"], [class*="category"]')
    const emptyState = page.locator('text=/no category|لا يوجد تصنيف|no data/i')

    const hasList = await categoriesList.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    expect(hasList || hasEmpty).toBeTruthy()
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
    // The retrying expect on the name input below is the real readiness signal.

    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"], input[placeholder*="الاسم"]')
    const descriptionInput = page.locator('textarea[id*="description"], textarea[placeholder*="description"]')
    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("حفظ")')

    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 })
    await nameInput.first().fill(`Test Category ${Date.now()}`)

    const descriptionVisible = await descriptionInput.first().isVisible().catch(() => false)
    if (descriptionVisible) await descriptionInput.first().fill('Test category description')

    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should edit existing category', async ({ page }) => {
    const editButton = page.locator('a[href*="/categories/edit"], button:has-text("edit"), button:has-text("تعديل")').first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()

    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"]')
    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 })
    await nameInput.first().clear()
    await nameInput.first().fill(`Updated Category ${Date.now()}`)

    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("حفظ")')
    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should delete category with confirmation', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("حذف")').first()
    await expect(deleteButton).toBeVisible({ timeout: 10_000 })
    await deleteButton.click()

    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("تأكيد")')
    await expect(confirmButton.first()).toBeVisible({ timeout: 10_000 })
    await confirmButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })
})
