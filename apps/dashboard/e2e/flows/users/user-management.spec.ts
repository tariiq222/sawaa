/**
 * user-management.spec.ts
 *
 * E2E: admin manages staff users (create → list → edit → delete) through
 * the dashboard UI at /users.
 *
 * Strategy: seed a dedicated disposable user in beforeAll so the list is
 * guaranteed to have at least one row, enabling the edit/delete actions to
 * be exercised against a real row. The create-user test POSTs through the UI
 * form, then cleans up the UI-created user via the API.
 *
 * Requires: backend on :5200, dashboard on :5203, seeded admin user.
 */
import { test, expect } from '@playwright/test'
import { loginAs } from '../../fixtures/auth'
import { getTestTenant } from '../../fixtures/tenant'
import {
  seedUser,
  cleanupUser,
  type SeededUser,
} from '../../fixtures/seed'

let token = ''
let seededUser: SeededUser

test.beforeAll(async ({ browser }) => {
  const organization = await getTestTenant()
  token = organization.accessToken
  seededUser = await seedUser(token, {
    name: 'E2E User (disposable)',
    role: 'RECEPTIONIST',
    gender: 'FEMALE',
  })

  // Warm the dashboard route table before tests start so loginAs's
  // `expectAuthenticatedShell(<main>)` (30s timeout) doesn't trip on cold
  // Turbopack compiles of the users layout + tabs + table + form routes.
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await loginAs(page, 'admin')
    await page.goto('/users', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 60_000 })
    await page.goto('/users/create', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main').first()).toBeVisible({ timeout: 60_000 })
  } finally {
    await context.close()
  }
})

test.afterAll(async () => {
  if (seededUser?.id) {
    await cleanupUser(seededUser.id, token).catch(() => undefined)
  }
})

test.describe('User Management', () => {
  // Cold dev-server compiles can push loginAs's `expectAuthenticatedShell`
  // (which waits up to 30s for `main`) past its timeout in local runs. CI
  // uses a pre-built dashboard so this is rarely hit there.
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/users')
    // Wait for the list GET to render the seeded user row.
    await expect(page.getByText(seededUser.email).first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('users list page loads and shows the seeded user', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /المستخدمون|Users/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(seededUser.email).first()).toBeVisible()
    await expect(page.getByText(seededUser.name).first()).toBeVisible()
  })

  test('search filters the user list by name', async ({ page }) => {
    const search = page.getByPlaceholder(/بحث|Search/i).first()
    await expect(search).toBeVisible({ timeout: 10_000 })

    // Server-side `contains` match on name. The seeded name is literally
    // "E2E User (disposable)" so we search for a substring that matches.
    await search.fill('E2E')
    // Wait for the debounced/refetched list to show the seeded row.
    await page.waitForResponse(
      (r) =>
        r.url().includes('/dashboard/identity/users') &&
        r.request().method() === 'GET' &&
        r.ok(),
      { timeout: 10_000 },
    ).catch(() => {})
    await expect(page.getByText(seededUser.email).first()).toBeVisible({
      timeout: 10_000,
    })

    // A non-matching search should hide it.
    await search.fill('zzzzz-no-match-user')
    await page.waitForResponse(
      (r) =>
        r.url().includes('/dashboard/identity/users') &&
        r.request().method() === 'GET' &&
        r.ok(),
      { timeout: 10_000 },
    ).catch(() => {})
    await expect(page.getByText(seededUser.email)).toHaveCount(0, {
      timeout: 10_000,
    })
  })

  test('navigates to the create-user page via the add button', async ({ page }) => {
    const addButton = page.getByRole('button', {
      name: /إضافة مستخدم|New User|Add User/i,
    })
    await expect(addButton).toBeVisible({ timeout: 10_000 })
    await addButton.click()
    await page.waitForURL('/users/create', { timeout: 10_000 })
    await expect(
      page
        .getByRole('heading', { name: /إنشاء مستخدم|إضافة|New User|Create User/i })
        .first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('creates a user through the UI form and the row appears in the list', async ({ page }) => {
    await page.goto('/users/create')

    const suffix = Date.now()
    const name = `UI User ${suffix}`
    const email = `ui-user-${suffix}@sawaa-test.com`

    // User form fields: name, email, password, phone (optional), role (Select).
    await page.locator('input[name="name"]').fill(name)
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill('UiUser@1234')

    // Submit button is the form's type="submit".
    const submitButton = page.locator('form button[type="submit"]')
    await expect(submitButton).toBeVisible({ timeout: 10_000 })
    await submitButton.click()

    // Successful create redirects to /users and the new email shows in the list.
    await page.waitForURL('/users', { timeout: 15_000 })
    await expect(page.getByText(email).first()).toBeVisible({
      timeout: 15_000,
    })

    // Clean up the UI-created user via the API so the suite is idempotent.
    const res = await fetch(
      `http://localhost:5200/api/v1/dashboard/identity/users?search=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.ok) {
      const body = (await res.json()) as {
        items?: Array<{ id: string; email: string }>
      }
      const found = body.items?.find((u) => u.email === email)
      if (found) {
        await cleanupUser(found.id, token).catch(() => undefined)
      }
    }
  })

  test('opens the edit page for the seeded user and updates the name', async ({ page }) => {
    const row = page.locator('tr', { hasText: seededUser.email }).first()
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

    // Edit page is /users/<ref>/edit (not /users/<uuid>/edit).
    await page.waitForURL(/\/users\/[^/]+\/edit$/, { timeout: 15_000 })

    // The form uses the name field; update it and submit.
    const nameInput = page.locator('input[name="name"]')
    await expect(nameInput).toBeVisible({ timeout: 10_000 })
    await nameInput.fill('E2E User (renamed)')

    // Submit button is the form's type="submit".
    const submitButton = page.locator('form button[type="submit"]')
    const patchPromise = page.waitForResponse(
      (r) =>
        /\/dashboard\/identity\/users\/[^/]+$/.test(r.url()) &&
        r.request().method() === 'PATCH' &&
        r.ok(),
      { timeout: 20_000 },
    )
    await submitButton.click()
    const patchRes = await patchPromise
    expect(patchRes.status()).toBe(200)

    // After PATCH succeeds the form calls router.push("/users") — wait on
    // that navigation. Use waitUntil: 'commit' so we don't block on a slow
    // Turbopack route compile that might delay the `load` event.
    await page.waitForURL('/users', { timeout: 15_000, waitUntil: 'commit' })

    // Confirm the rename actually landed by reading the seeded user's record
    // directly — this avoids coupling to client-side refetch timing.
    const detailRes = await fetch(
      `http://localhost:5200/api/v1/dashboard/identity/users/${seededUser.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    expect(detailRes.ok).toBeTruthy()
    const detail = (await detailRes.json()) as { name: string }
    expect(detail.name).toBe('E2E User (renamed)')

    // Restore the original name via the API so this test is idempotent.
    const restoreRes = await fetch(
      `http://localhost:5200/api/v1/dashboard/identity/users/${seededUser.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: seededUser.name }),
      },
    )
    if (!restoreRes.ok) {
      throw new Error(
        `[e2e/users] failed to restore user name: HTTP ${restoreRes.status}`,
      )
    }

    // Restore the original name via the API so this test is idempotent.
    const res = await fetch(
      `http://localhost:5200/api/v1/dashboard/identity/users/${seededUser.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: seededUser.name }),
      },
    )
    if (!res.ok) {
      throw new Error(
        `[e2e/users] failed to restore user name: HTTP ${res.status}`,
      )
    }
  })

  test('deletes a user through the actions menu', async ({ page }) => {
    // Seed a dedicated disposable user so we never delete the row other tests
    // rely on (the one in seededUser).
    const disposable = await seedUser(token, {
      name: 'E2E User (to delete)',
      role: 'RECEPTIONIST',
    })

    // Reload to ensure the new row is fetched by the list query.
    await page.goto('/users')
    await expect(page.getByText(disposable.email).first()).toBeVisible({
      timeout: 15_000,
    })

    const row = page.locator('tr', { hasText: disposable.email }).first()
    const actionsTrigger = row
      .getByRole('button', { name: /Actions|إجراءات/ })
      .last()
    await actionsTrigger.click()
    const deleteItem = page.getByRole('menuitem', {
      name: /^حذف$|^Delete$/,
    })
    await expect(deleteItem).toBeVisible({ timeout: 5_000 })
    await deleteItem.click()

    // DeleteUserDialog uses role="dialog" (not alertdialog) — match that.
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // The destructive action button reuses the Delete label.
    const confirmButton = dialog.locator('button', {
      hasText: /^حذف$|^Delete$/,
    })
    await expect(confirmButton).toBeVisible({ timeout: 5_000 })
    const deletePromise = page.waitForResponse(
      (r) =>
        /\/dashboard\/identity\/users\/[^/]+$/.test(r.url()) &&
        r.request().method() === 'DELETE' &&
        r.ok(),
      { timeout: 20_000 },
    )
    await confirmButton.click()
    const deleteRes = await deletePromise
    expect(deleteRes.status()).toBe(204)

    // The dialog closes and the row disappears from the list.
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    await expect(page.getByText(disposable.email)).toHaveCount(0, {
      timeout: 15_000,
    })

    // Belt-and-braces: confirm at the API level too. cleanupUser is a no-op
    // when the row is already gone (DELETE returns 404 → swallowed).
    await cleanupUser(disposable.id, token).catch(() => undefined)
  })
})
