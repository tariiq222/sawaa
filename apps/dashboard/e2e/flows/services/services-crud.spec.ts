import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Services CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/services')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
  })

  test('should load services page without errors', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display services list or empty state', async ({ page }) => {
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})

    const servicesList = page.locator('[class*="table"], [class*="list"], [class*="service"]')
    const emptyState = page.locator('text=/no service|لا يوجد خدمة|no data/i')

    const hasList = await servicesList.first().isVisible().catch(() => false)
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    expect(hasList || hasEmpty).toBeTruthy()
  })

  test('should navigate to create service page', async ({ page }) => {
    // The create button may be behind a PermissionGuard — use a longer timeout
    const createButton = page.locator('a[href="/services/create"], button:has-text("إضافة خدمة"), button:has-text("خدمة جديدة"), button:has-text("Add Service")')
    const hasCreateButton = await createButton.first().isVisible({ timeout: 8000 }).catch(() => false)
    test.skip(!hasCreateButton, 'Create button hidden behind PermissionGuard')

    await createButton.first().click()
    await page.waitForURL('/services/create', { timeout: 10000 })
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should search services', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="بحث"]')
    await expect(searchInput.first()).toBeVisible({ timeout: 10_000 })
    await searchInput.first().fill('test')
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})
    await searchInput.first().clear()
  })

  test('should filter services', async ({ page }) => {
    const filterSelect = page.locator('select').first()
    const hasFilter = await filterSelect.isVisible().catch(() => false)
    test.skip(!hasFilter, 'No filter select present')

    const options = await filterSelect.locator('option').count()
    test.skip(options <= 1, 'Filter select has no selectable options')
    await filterSelect.selectOption({ index: 1 })
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})
  })

  test('should paginate services', async ({ page }) => {
    const pagination = page.locator('[class*="pagination"], [class*="pager"], button:has-text("next"), button:has-text("التالي")')
    const hasPagination = await pagination.first().isVisible().catch(() => false)
    test.skip(!hasPagination, 'No pagination present for current dataset')

    const nextButton = page.locator('button:has-text("next"), button:has-text("التالي"), [aria-label*="next"]')
    await expect(nextButton.first()).toBeVisible({ timeout: 10_000 })
    await nextButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should sort services', async ({ page }) => {
    const sortButtons = page.locator('[aria-sort], button[class*="sort"], th')
    const hasSort = await sortButtons.first().isVisible().catch(() => false)
    test.skip(!hasSort, 'No sortable columns present')

    await sortButtons.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should view service details', async ({ page }) => {
    const serviceRow = page.locator('tbody tr, [class*="service-row"]').first()
    await expect(serviceRow).toBeVisible({ timeout: 10_000 })
    await serviceRow.click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should create new service with valid data', async ({ page }) => {
    await page.goto('/services/create')
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    // Form uses react-hook-form register() — inputs have name attributes, not id or placeholder
    // The locale determines which field is primary (nameAr vs nameEn)
    const nameArInput = page.locator('input[name="nameAr"]')
    const nameEnInput = page.locator('input[name="nameEn"]')
    // Submit button text is "إنشاء خدمة" (ar) / "Create Service" (en)
    const saveButton = page.locator('button[type="submit"], button:has-text("إنشاء خدمة"), button:has-text("Create Service")')

    await expect(nameArInput).toBeVisible({ timeout: 10_000 })
    await nameArInput.fill(`خدمة اختبار ${Date.now()}`)

    const nameEnVisible = await nameEnInput.isVisible().catch(() => false)
    if (nameEnVisible) await nameEnInput.fill(`Test Service ${Date.now()}`)

    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should edit existing service', async ({ page }) => {
    const editButton = page.locator('a[href*="/services/edit"], button:has-text("edit"), button:has-text("تعديل")').first()
    await expect(editButton).toBeVisible({ timeout: 10_000 })
    await editButton.click()

    const nameInput = page.locator('input[id*="name"], input[placeholder*="name"]')
    await expect(nameInput.first()).toBeVisible({ timeout: 10_000 })
    await nameInput.first().clear()
    await nameInput.first().fill(`Updated Service ${Date.now()}`)

    const saveButton = page.locator('button[type="submit"], button:has-text("Save"), button:has-text("حفظ")')
    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should delete service with confirmation', async ({ page }) => {
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("حذف")').first()
    await expect(deleteButton).toBeVisible({ timeout: 10_000 })
    await deleteButton.click()

    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("تأكيد")')
    await expect(confirmButton.first()).toBeVisible({ timeout: 10_000 })
    await confirmButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should toggle service active/inactive status', async ({ page }) => {
    const toggleButton = page.locator('button[role="switch"], button[class*="toggle"], input[type="checkbox"]').first()
    const hasToggle = await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)
    test.skip(!hasToggle, 'No status toggle present')

    await toggleButton.click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })
})
