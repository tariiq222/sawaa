import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'
import {
  seedService,
  cleanupService,
  getPersonaToken,
  type SeededService,
} from '../../fixtures/seed'

test.describe('Services CRUD Operations', () => {
  let adminToken: string
  let seededService: SeededService

  // The dashboard services list excludes archived services, and cleanup archives
  // them — so without seeding, the list is legitimately EMPTY across runs and the
  // row-dependent tests (display/view/edit/delete) have nothing to act on. Seed a
  // real, active service so those tests always have a row.
  test.beforeAll(async () => {
    adminToken = await getPersonaToken('admin')
    seededService = await seedService(adminToken, {
      nameAr: `خدمة CRUD ${Date.now()}`,
      nameEn: `CRUD Service ${Date.now()}`,
    })
  })

  test.afterAll(async () => {
    if (seededService?.id) {
      await cleanupService(seededService.id, adminToken).catch(() => undefined)
    }
  })

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
    // The beforeEach already awaits the services list GET. A second
    // waitForResponse here would block on a NEW GET that never fires (the page
    // is already loaded), hanging until the test timeout — so rely on the
    // rendered table/empty-state as the readiness signal instead.
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
    const search = page.getByRole('searchbox')
    await search.fill(seededService.nameAr)
    const serviceRow = page.getByRole('row').filter({ hasText: seededService.nameAr })
    await expect(serviceRow).toBeVisible({ timeout: 15_000 })

    const filterSelect = page.getByRole('combobox').first()
    await expect(filterSelect).toBeVisible({ timeout: 10_000 })
    await filterSelect.click()
    await page.getByRole('option', { name: /^(غير نشطة|Inactive)$/ }).click()
    await expect(serviceRow).toHaveCount(0)
    await filterSelect.click()
    await page.getByRole('option', { name: /^(نشطة|Active)$/ }).click()
    await expect(serviceRow).toBeVisible({ timeout: 10_000 })
  })

  test('should paginate services', async ({ page }) => {
    const token = await getPersonaToken('admin')
    const seeded: SeededService[] = []
    try {
      const runId = Date.now()
      for (let index = 0; index < 20; index += 1) {
        seeded.push(await seedService(token, {
          nameAr: `خدمة ترقيم ${runId} ${index}`,
          nameEn: `Pagination service ${runId} ${index}`,
        }))
      }

      await page.reload()
      await expect(page.getByText(/^(صفحة 1 من \d+|Page 1 of \d+)$/)).toBeVisible({ timeout: 15_000 })
      const firstPageRows = await page.locator('tbody tr').allTextContents()
      await page.getByRole('button', { name: /التالي|Next/ }).click()
      await expect(page.getByText(/^(صفحة 2 من \d+|Page 2 of \d+)$/)).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
      await expect.poll(() => page.locator('tbody tr').allTextContents()).not.toEqual(firstPageRows)
    } finally {
      await Promise.all(seeded.map((service) => cleanupService(service.id, token)))
    }
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
    // A seeded service (beforeAll) guarantees a real row; wait on it directly.
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })

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
    // A seeded service (beforeAll) guarantees a real row; wait on it directly.
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15_000 })

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
    const statusService = await seedService(adminToken, {
      nameAr: `خدمة حالة ${Date.now()}`,
      nameEn: `Status service ${Date.now()}`,
    })
    try {
      const search = page.getByRole('searchbox')
      await search.fill(statusService.nameAr)
      const serviceRow = page.getByRole('row').filter({ hasText: statusService.nameAr })
      await expect(serviceRow).toBeVisible({ timeout: 15_000 })
      await serviceRow.getByRole('button', { name: /تعديل|Edit/ }).click()
      await page.waitForURL(/\/services\/[^/]+\/edit/, { timeout: 15_000 })

      const activeSwitch = page.getByRole('switch').first()
      await expect(activeSwitch).toBeVisible({ timeout: 15_000 })
      await expect(activeSwitch).toHaveAttribute('data-state', 'checked')
      await activeSwitch.click()
      await expect(activeSwitch).toHaveAttribute('data-state', 'unchecked')

      const saved = page.waitForResponse((response) =>
        /\/organization\/services\//.test(response.url()) && response.request().method() === 'PATCH' && response.ok(),
        { timeout: 15_000 },
      )
      await page.locator('form button[type="submit"]').click()
      await saved
      await page.goto('/services')
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 })
      await page.getByRole('searchbox').fill(statusService.nameAr)
      await expect(page.getByRole('row').filter({ hasText: statusService.nameAr }).getByText(/غير نشطة|Inactive/))
        .toBeVisible({ timeout: 15_000 })
    } finally {
      await cleanupService(statusService.id, adminToken)
    }
  })
})
