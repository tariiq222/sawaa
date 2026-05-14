import { test, expect } from "@playwright/test"

/**
 * [D1b] Login error UX — Alert banner
 *
 * Verifies that a wrong password shows the new structured Alert banner
 * (title + description + "Forgot password?" link) and that editing the
 * password clears the banner.
 */
test.describe("[D1b] Login error alert", () => {
  test("wrong password shows Arabic alert with forgot-password link", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#identifier").fill("admin@deqah-test.com")
    await page.getByRole("button", { name: "متابعة" }).click()

    await expect(
      page.getByRole("button", { name: "باستخدام كلمة المرور" }),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole("button", { name: "باستخدام كلمة المرور" }).click()

    await expect(page.locator("#password")).toBeVisible({ timeout: 10_000 })
    await page.locator("#password").fill("wrong-password-123")
    await page.getByRole("button", { name: "تسجيل الدخول" }).click()

    const alert = page.getByTestId("login-error-alert")
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText("تعذّر تسجيل الدخول")

    const forgotLink = alert.getByRole("link", { name: "نسيت كلمة المرور؟" })
    await expect(forgotLink).toBeVisible()
    await expect(forgotLink).toHaveAttribute("href", /\/forgot-password$/)
  })

  test("alert clears when user edits the password", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#identifier").fill("admin@deqah-test.com")
    await page.getByRole("button", { name: "متابعة" }).click()
    await page.getByRole("button", { name: "باستخدام كلمة المرور" }).click()
    await page.locator("#password").fill("wrong-password-123")
    await page.getByRole("button", { name: "تسجيل الدخول" }).click()

    const alert = page.getByTestId("login-error-alert")
    await expect(alert).toBeVisible({ timeout: 10_000 })

    await page.locator("#password").press("End")
    await page.locator("#password").pressSequentially("x")

    await expect(alert).toBeHidden()
  })
})
