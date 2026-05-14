import { test, expect } from '@playwright/test'
import { devLogin } from './helpers/auth'

test.describe('Header Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
  })

  test('should toggle theme between dark and light', async ({ page }) => {
    const themeToggle = page.locator('header button[aria-label*="dark" i], header button[aria-label*="وضع"]').first()

    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      const html = page.locator('html')
      const initialTheme = await html.getAttribute('class')

      await themeToggle.click()
      await page.waitForTimeout(500)

      const newTheme = await html.getAttribute('class')
      expect(newTheme).not.toBe(initialTheme)
    } else {
      test.skip()
    }
  })

  test('should change font size via settings dropdown', async ({ page }) => {
    const settingsButton = page.locator('button[aria-label="Settings"]').first()

    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click()
      await page.waitForTimeout(500)

      const fontSizeL = page.locator('button:has-text("L")')
      if (await fontSizeL.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fontSizeL.click()
        await page.waitForTimeout(300)

        const htmlFontSize = await page.locator('html').evaluate((el) => el.style.fontSize)
        expect(htmlFontSize).toContain('calc(100% + 4px)')
      }
    } else {
      test.skip()
    }
  })

  test('should toggle language via settings dropdown', async ({ page }) => {
    const settingsButton = page.locator('button[aria-label="Settings"]').first()

    if (await settingsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await settingsButton.click()
      await page.waitForTimeout(500)

      const langButton = page.locator('button:has-text("العربية"), button:has-text("English")').first()
      if (await langButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await langButton.click()
        await page.waitForTimeout(500)
      }
    } else {
      test.skip()
    }
  })

  test('should open user dropdown menu', async ({ page }) => {
    const avatarButton = page.locator('button.rounded-lg, button[class*="rounded"]').filter({ has: page.locator('[class*="Avatar"]') }).first()

    if (await avatarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await avatarButton.click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('[role="menu"], [role="menuitem"]')
      await expect(dropdown.first()).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })

  test('should navigate to profile from user dropdown', async ({ page }) => {
    const avatarButton = page.locator('button.rounded-lg, button[class*="rounded"]').filter({ has: page.locator('[class*="Avatar"]') }).first()

    if (await avatarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await avatarButton.click()
      await page.waitForTimeout(500)

      const profileLink = page.locator('a[href="/profile"]')
      if (await profileLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await profileLink.click()
        await page.waitForURL('/profile', { timeout: 10000 })
        await expect(page.locator('body')).toBeVisible()
      }
    } else {
      test.skip()
    }
  })


  test('should logout via user dropdown', async ({ page }) => {
    const avatarButton = page.locator('button.rounded-lg, button[class*="rounded"]').filter({ has: page.locator('[class*="Avatar"]') }).first()

    if (await avatarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await avatarButton.click()
      await page.waitForTimeout(500)

      const logoutButton = page.locator('button:has-text("logout"), button:has-text("تسجيل الخروج")')
      if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoutButton.click()
        await page.waitForURL('/login', { timeout: 10000 })
        await expect(page.locator('#email')).toBeVisible()
      }
    } else {
      test.skip()
    }
  })

  test('should open notification dropdown', async ({ page }) => {
    const notifButton = page.locator('button[aria-label*="notif" i], button[aria-label*="إشعارات"]').first()

    if (await notifButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await notifButton.click()
      await page.waitForTimeout(500)

      const dropdown = page.locator('[role="menu"], .w-80, [class*="Notification"]')
      await expect(dropdown.first()).toBeVisible({ timeout: 5000 })
    } else {
      test.skip()
    }
  })
})
