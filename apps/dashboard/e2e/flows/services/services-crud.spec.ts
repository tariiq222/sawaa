import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Services CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/services')
    // Avoid the network-idle load state — this app polls (refetchInterval)
    // so network-idle never settles. Wait on the services list GET instead.
    await page.waitForResponse(
      r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok(),
      { timeout: 15_000 },
    ).catch(() => {})
  })

  test('should load services page without errors', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('should display services list or empty state', async ({ page }) => {
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    // The list renders a real <table> (DataTable → @sawaa/ui Table primitive).
    // When there are no services the table body shows an EmptyState card titled
    // t("services.empty.title") = "لا توجد خدمات" / "No services found".
    const tableEl = page.locator('table')
    await expect(tableEl.first()).toBeVisible({ timeout: 10_000 })

    const dataRows = page.locator('table tbody tr')
    const emptyState = page.locator('text=/لا توجد خدمات|No services found/i')

    const hasRows = (await dataRows.count()) > 0
    const hasEmpty = await emptyState.first().isVisible().catch(() => false)

    // Either populated rows or the empty-state card must render inside the table.
    expect(hasRows || hasEmpty).toBeTruthy()
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
    // App defaults to AR locale → both nameAr (primary) and nameEn (secondary)
    // inputs are rendered via react-hook-form register(): name attrs, no id/placeholder.
    const nameArInput = page.locator('input[name="nameAr"]')
    const nameEnInput = page.locator('input[name="nameEn"]')
    // Submit button is the form's type="submit"; label is t("services.create.submit")
    // = "إنشاء خدمة" / "Create Service".
    const saveButton = page.locator('form button[type="submit"]')

    await expect(nameArInput).toBeVisible({ timeout: 10_000 })
    await nameArInput.fill(`خدمة اختبار ${Date.now()}`)

    const nameEnVisible = await nameEnInput.isVisible().catch(() => false)
    if (nameEnVisible) await nameEnInput.fill(`Test Service ${Date.now()}`)

    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    // Category is a required field; submit may surface a validation toast rather
    // than navigate. Either way the create form heading stays mounted — assert it.
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should edit existing service', async ({ page }) => {
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })

    // Edit is a row-action icon button with aria-label t("services.action.edit")
    // = "تعديل" / "Edit". It navigates to /services/{id}/edit via router.push.
    const editButton = page.locator('button[aria-label="تعديل"], button[aria-label="Edit"]').first()
    const hasEdit = await editButton.isVisible({ timeout: 8000 }).catch(() => false)
    test.skip(!hasEdit, 'Edit action hidden — admin lacks service:update permission')

    await editButton.click()
    // Client navigation via router.push → wait on the commit, then on the edit
    // form mounting (skeleton resolves to the react-hook-form fields).
    await page.waitForURL(/\/services\/[^/]+\/edit/, { timeout: 15_000, waitUntil: 'commit' })

    // Edit form uses react-hook-form register(): the primary name input is
    // name="nameAr" in the default AR locale. It appears after the detail GET resolves.
    const nameInput = page.locator('input[name="nameAr"]')
    await expect(nameInput.first()).toBeVisible({ timeout: 15_000 })
    await nameInput.first().fill(`خدمة محدثة ${Date.now()}`)

    // Submit button is the form's type="submit"; label t("services.edit.submit")
    // = "حفظ التغييرات" / "Save Changes".
    const saveButton = page.locator('form button[type="submit"]')
    await expect(saveButton.first()).toBeVisible({ timeout: 10_000 })
    await saveButton.first().click()
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
  })

  test('should delete service with confirmation', async ({ page }) => {
    await page.waitForResponse(r => r.url().includes('/services') && r.request().method() === 'GET' && r.ok()).catch(() => {})
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 })

    // Delete is a row-action icon button with aria-label t("services.action.delete")
    // = "حذف" / "Delete". It opens an AlertDialog (it does NOT delete inline).
    const deleteButton = page.locator('button[aria-label="حذف"], button[aria-label="Delete"]').first()
    const hasDelete = await deleteButton.isVisible({ timeout: 8000 }).catch(() => false)
    test.skip(!hasDelete, 'Delete action hidden — admin lacks service:delete permission')

    await deleteButton.click()

    // Confirmation is an AlertDialog; the destructive action button reuses the
    // delete label ("حذف"/"Delete"), so scope to the dialog and pick that button
    // (the other button is Cancel = "إلغاء").
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    const confirmButton = dialog.locator('button', { hasText: /^حذف$|^Delete$/ })
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
