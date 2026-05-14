import { Page } from '@playwright/test'

export async function devLogin(page: Page): Promise<void> {
  await page.goto('/login')

  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev) return

  const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL
  const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD

  if (!devEmail || !devPassword) return

  const devLoginButton = page.locator('button:has-text("Dev Admin Login")')
  if (await devLoginButton.isVisible()) {
    await devLoginButton.click()
    await page.waitForURL('/', { timeout: 10000 })
  }

  await page.waitForTimeout(500)
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

  await page.fill('#email', email)
  await page.fill('#password', password)

  await page.click('button[type="submit"]')

  await page.waitForTimeout(2000)
}
