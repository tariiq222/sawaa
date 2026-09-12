import { test, expect, type Page } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"

// loginAs checks the authenticated shell at a desktop width; the responsive
// assertions begin after authentication on the narrow viewport.
test.use({ viewport: { width: 1280, height: 900 } })

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            Math.max(
              document.documentElement.scrollWidth,
              document.body.scrollWidth,
            ) <= window.innerWidth,
        ),
      { timeout: 1_500 },
    )
    .toBe(true)
}

test("package editor general draft stays usable at 390px in Arabic and English", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await loginAs(page, "admin")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/packages/create", { waitUntil: "domcontentloaded" })

  await expect(page.locator("html")).toHaveAttribute("lang", "ar")
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await expect(page.getByRole("heading", { name: "باقة جلسات جديدة", exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("combobox", { name: "نوع الباقة والممارس المسؤول" })).toContainText("باقة عامة")
  await page.locator('input[name="nameAr"]').fill("مسودة فحص الجوال")
  await page.getByRole("button", { name: "التالي", exact: true }).click()

  await expect(page.getByText("بنود الباقة", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "إضافة بند", exact: true }).click()
  const item = page.locator('[data-package-item="0"]')
  await item.getByRole("button", { name: /اختيار عند الحجز/ }).click()

  const next = page.getByRole("button", { name: "التالي", exact: true })
  const back = page.getByRole("button", { name: "السابق", exact: true })
  await expect(next).toBeVisible()
  await expect(next).toBeEnabled()
  await expect(back).toBeVisible()
  await expect(back).toBeEnabled()
  await assertNoHorizontalOverflow(page)
  await next.click()

  const price = page.locator("#items\\.0\\.unitPriceSar")
  await expect(price).toBeVisible()
  await price.fill("100")
  await expect(page.getByText(/^3\. العدد والسعر$/).first()).toBeVisible()
  await expect(next).toBeEnabled()
  await expect(back).toBeEnabled()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath("package-editor-ar-390x844.png"), fullPage: true })

  await back.click()
  await expect(page.getByText("بنود الباقة", { exact: true })).toBeVisible()
  await expect(item.getByRole("button", { name: /اختيار عند الحجز/ })).toBeVisible()
  await next.click()
  await expect(price).toHaveValue("100")

  await page.getByRole("button", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: /اللغة.*English/ }).click()
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  await page.keyboard.press("Escape")
  await expect(page.getByRole("heading", { name: "New Session Package", exact: true })).toBeVisible()
  await expect(page.getByText("Package items", { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder("Price per session (SAR)")).toHaveValue("100")
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Back", exact: true })).toBeEnabled()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: testInfo.outputPath("package-editor-en-390x844.png"), fullPage: true })
})
