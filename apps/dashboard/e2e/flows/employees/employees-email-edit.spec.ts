import { test, expect } from '@playwright/test'
import { expectCurrentPath } from '../../fixtures/assertions'
import { loginAs } from '../../fixtures/auth'

test('admin can edit an existing practitioner email', async ({ page }) => {
  await loginAs(page, 'admin')
  await page.goto('/employees')
  await expectCurrentPath(page, '/employees')

  const editButton = page.getByRole('button', { name: 'تعديل' }).first()
  await expect(editButton).toBeVisible({ timeout: 10_000 })
  await editButton.click()
  await page.waitForURL(/\/employees\/[^/]+\/edit/, { timeout: 10_000 })

  const emailInput = page.locator('input[name="email"]')
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await expect(emailInput).toBeEnabled()
  await expect(emailInput).not.toHaveAttribute('readonly')
  await expect(emailInput).toBeEditable()
})
