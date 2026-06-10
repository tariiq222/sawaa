import { expect, Page } from '@playwright/test'
import { loginAs } from '../fixtures/auth'

export async function devLogin(page: Page): Promise<void> {
  await loginAs(page, 'admin')
}

export async function logout(page: Page): Promise<void> {
  await page.goto('/')

  const userButton = page.locator('header button').filter({ has: page.locator('svg') }).last()
  if (await userButton.isVisible()) {
    await userButton.click()

    // Opening the user menu must reveal the logout entry — wait on it directly.
    const logoutButton = page.locator('text=/logout|تسجيل الخروج/i')
    await expect(logoutButton.first()).toBeVisible({ timeout: 5_000 })
    await logoutButton.click()
    await page.waitForURL('/login', { timeout: 10000 })
  }
}

export async function loginWithCredentials(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login')

  await page.locator('#identifier').fill(email)
  await page.getByRole('button', { name: 'متابعة' }).click()
  await page.getByRole('button', { name: 'باستخدام كلمة المرور' }).click()
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click()

  // Successful login navigates away from /login — wait on that concrete signal.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
}
