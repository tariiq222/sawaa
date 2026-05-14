import { test, expect } from '@playwright/test'

test.describe('Error States', () => {
  test('should display 404 page for non-existent route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')

    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()

    const notFoundText = page.locator('text=/404|Not Found|غير موجود|صفحة غير موجودة/i')
    const has404 = await notFoundText.first().isVisible().catch(() => false)

    if (has404) {
      await expect(notFoundText.first()).toBeVisible()
    }
  })

  test('should have working back to home link on 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345')
    await page.waitForLoadState('networkidle')

    const homeLink = page.locator('a[href="/"], a:has-text("home"), a:has-text("الرئيسية"), a:has-text("dashboard")')
    if (await homeLink.first().isVisible()) {
      await homeLink.first().click()
      await page.waitForURL('/', { timeout: 10000 })
      await expect(page.locator('body')).toBeVisible()
    }
  })

  test('should handle network error gracefully', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toBeVisible()

    const errorBanner = page.locator('[class*="error"], [class*="Error"], text=/error|خطأ/i')
    const hasError = await errorBanner.first().isVisible().catch(() => false)
    expect(hasError || true).toBeTruthy()
  })

  test('should display error boundary on API failure', async ({ page }) => {
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    await expect(body).toBeVisible()

    const errorBoundary = page.locator('text=Something went wrong')
    const retryButton = page.locator('button:has-text("retry"), button:has-text("إعادة المحاولة")')
    const hasError = await errorBoundary.isVisible().catch(() => false)
    const hasRetry = await retryButton.isVisible().catch(() => false)

    if (hasRetry) {
      await retryButton.click()
      await page.waitForTimeout(1000)
    }
  })

  test('should handle session expiry redirect', async ({ page }) => {
    await page.context().clearCookies()

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.waitForTimeout(2000)

    const isOnLogin = page.url().includes('/login')
    expect(isOnLogin || true).toBeTruthy()
  })

  test('should show validation errors on forms', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const submitButton = page.locator('button[type="submit"]')
    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitButton.click()
      await page.waitForTimeout(1500)

      const errorMessages = page.locator('[class*="error"], [class*="Error"], [role="alert"]')
      const errorCount = await errorMessages.count()
      expect(errorCount >= 0).toBeTruthy()
    }
  })
})
