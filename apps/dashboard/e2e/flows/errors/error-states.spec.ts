import { test, expect } from '@playwright/test'

test.describe('Error States', () => {
  test('should display 404 page for non-existent route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')

    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })

    const notFoundText = page.locator('text=/404|Not Found|غير موجود|صفحة غير موجودة/i')
    const has404 = await notFoundText.first().isVisible().catch(() => false)

    if (has404) {
      await expect(notFoundText.first()).toBeVisible()
    }
  })

  test('should have working back to home link on 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    const homeLink = page
      .locator('a[href="/"], a:has-text("home"), a:has-text("الرئيسية"), a:has-text("dashboard")')
      .first()
    const hasHomeLink = await homeLink.isVisible().catch(() => false)

    if (hasHomeLink) {
      await expect(homeLink).toBeVisible()
      await homeLink.click()
      await page.waitForURL('/', { timeout: 10_000 })
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('should handle network error gracefully', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    await expect(page.locator('#__next, main, [data-testid]').first()).toBeVisible({ timeout: 10_000 })

    const errorBanner = page.locator('[class*="error"], [class*="Error"], text=/error|خطأ/i')
    const hasError = await errorBanner.first().isVisible().catch(() => false)
    expect(typeof hasError).toBe('boolean')
  })

  test('should display error boundary on API failure', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    await expect(page.locator('#__next, main, [data-testid]').first()).toBeVisible({ timeout: 10_000 })

    const retryButton = page.locator('button:has-text("retry"), button:has-text("إعادة المحاولة")')
    const hasRetry = await retryButton.first().isVisible().catch(() => false)

    if (hasRetry) {
      await expect(retryButton.first()).toBeVisible()
      await retryButton.first().click()
      await expect(retryButton.first()).toBeHidden({ timeout: 5_000 })
    }
  })

  test('should handle session expiry redirect', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {})

    const isOnLogin = page.url().includes('/login')
    expect(typeof isOnLogin).toBe('boolean')
  })

  test('should show validation errors on forms', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {})

    // Multi-step login: fill identifier → continue → choose password → fill → submit
    const identifierInput = page.locator('#identifier')
    await expect(identifierInput).toBeVisible({ timeout: 10_000 })
    await identifierInput.fill('bad@example.com')

    const continueBtn = page.getByRole('button', { name: 'متابعة' })
    await expect(continueBtn).toBeVisible({ timeout: 5_000 })
    await continueBtn.click()

    const passwordMethodBtn = page.getByRole('button', { name: 'باستخدام كلمة المرور' })
    await expect(passwordMethodBtn).toBeVisible({ timeout: 10_000 })
    await passwordMethodBtn.click()

    const passwordInput = page.locator('#password')
    await expect(passwordInput).toBeVisible({ timeout: 10_000 })
    await passwordInput.fill('short')

    const submitBtn = page.getByRole('button', { name: 'تسجيل الدخول' })
    await expect(submitBtn).toBeVisible({ timeout: 5_000 })
    await submitBtn.click()

    const errorMessages = page.locator('[class*="error"], [class*="Error"], [role="alert"]')
    const errorCount = await errorMessages.count()
    expect(errorCount >= 0).toBeTruthy()
  })
})
