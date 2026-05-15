import { Page } from '@playwright/test'
import { loginAs } from '../fixtures/auth'

export async function devLogin(page: Page): Promise<void> {
  await loginAs(page, 'admin')
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/')

  const userButton = page.locator('header button').filter({ has: page.locator('svg') }).last()
  if (await userButton.isVisible()) {
    await userButton.click()
    await page.waitForTimeout(300)

    const logoutButton = page.locator('text=/logout|تسجيل الخروج/i')
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      await page.waitForURL('/login', { timeout: 10000 })
    }
  }
}

export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login')

  await page.fill('#identifier', email)
  await page.fill('#password', password)

  await page.click('button[type="submit"]')

  await page.waitForTimeout(2000)
}
