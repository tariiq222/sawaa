import { expect, test, type Page } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import { getTestTenant } from "../../fixtures/tenant"
import { dashboardApiRequest } from "../../fixtures/seed"

const runId = String(Date.now()).slice(-6)
const createdPackageIds = new Set<string>()
let token = ""

async function openCreateForm(page: Page): Promise<string> {
  const response = await dashboardApiRequest("/dashboard/organization/packages", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelVersion: "LEGACY",
      nameAr: `باقة تحقق ${runId}`,
      items: [
        {
          constraints: [
            { dimension: "SERVICE", mode: "ANY" },
            { dimension: "PRACTITIONER", mode: "ANY" },
            { dimension: "DURATION", mode: "ANY" },
          ],
          unitPrice: 10_000,
          paidQuantity: 1,
          freeQuantity: 0,
        },
      ],
    }),
  })
  if (!response.ok) throw new Error(`legacy package fixture failed: ${response.status}`)
  const created = (await response.json()) as { id: string }
  createdPackageIds.add(created.id)
  await loginAs(page, "admin")
  await page.goto(`/packages/${created.id}/edit`, { waitUntil: "domcontentloaded" })
  await expect(page.locator('input[name="nameAr"]')).toBeVisible({
    timeout: 20_000,
  })
  return created.id
}

async function addFlexibleItem(page: Page, unitPriceSar = "100") {
  await expect(page.getByRole("button", { name: "اختيار عند الحجز" })).toBeVisible()
  await page.getByRole("button", { name: "التالي" }).click()
  const unitPrice = page.locator("#items\\.0\\.unitPriceSar")
  await expect(unitPrice).toBeVisible()
  await unitPrice.fill(unitPriceSar)
}

test.beforeAll(async () => {
  token = (await getTestTenant()).accessToken
})

test.afterEach(async () => {
  for (const id of createdPackageIds) {
    await dashboardApiRequest(`/dashboard/organization/packages/${id}`, token, {
      method: "DELETE",
    }).catch(() => undefined)
  }
  createdPackageIds.clear()
})

test.describe("Session Packages — form validation and save feedback", () => {
  test("shows every missing/invalid field locally and does not submit", async ({
    page,
  }) => {
    await openCreateForm(page)
    await page.locator('input[name="nameAr"]').fill("")

    let packageMutations = 0
    page.on("request", (request) => {
      if (
        ["POST", "PATCH"].includes(request.method()) &&
        request.url().includes("/dashboard/organization/packages")
      ) {
        packageMutations += 1
      }
    })

    await page.getByRole("button", { name: "التالي" }).click()

    const nameAr = page.locator('input[name="nameAr"]')
    await expect(page.getByText("أكمل الحقول المطلوبة للانتقال للخطوة التالية")).toBeVisible()
    await expect(nameAr).toHaveAttribute("aria-invalid", "true")
    await expect(nameAr).toBeFocused()
    await expect(page.getByText("هذا الحقل مطلوب")).toBeVisible()
    await nameAr.fill(`باقة تحقق ${runId}`)
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(page.getByText("بنود الباقة", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(page.locator("#items\\.0\\.unitPriceSar")).toBeVisible()
    await page.locator("#items\\.0\\.unitPriceSar").fill("")
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(
      page.getByText("يلزم تحديد سعر ثابت للجلسة في البنود المرنة")
    ).toBeVisible()

    await page.locator("#items\\.0\\.unitPriceSar").fill("100")
    await page.locator("#items\\.0\\.paidQuantity").fill("0")
    await page.locator("#items\\.0\\.freeQuantity").fill("0")
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(
      page.getByText(
        "يجب أن يحتوي كل بند على جلسة واحدة على الأقل (مدفوعة أو مجانية)"
      )
    ).toBeVisible()

    await page.locator("#items\\.0\\.paidQuantity").fill("2")
    await page.locator("#items\\.0\\.discountType").click()
    await page.getByRole("option", { name: "نسبة مئوية (%)" }).click()
    await page.locator("#items\\.0\\.discountValue").fill("101")
    await page.getByRole("button", { name: "التالي" }).click()
    await expect(
      page.getByText("يجب أن تكون نسبة الخصم بين 0 و100")
    ).toBeVisible()

    expect(packageMutations).toBe(0)
  })

  test("keeps save successful when image upload fails, then updates the package", async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.route("**/dashboard/media/upload", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "simulated image failure" }),
      })
    })
    const packageId = await openCreateForm(page)

    const packageName = `باقة حفظ وصورة ${runId}`
    await page.locator('input[name="nameAr"]').fill(packageName)

    await page
      .locator("form")
      .getByRole("button", { name: "ب", exact: true })
      .click()
    await page.getByRole("tab", { name: "صورة" }).click()
    const fileChooserPromise = page.waitForEvent("filechooser")
    await page.getByRole("button", { name: /اضغط لرفع صورة/ }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: "package-cover.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3ioAAAAASUVORK5CYII=",
        "base64"
      ),
    })

    await page.getByRole("button", { name: "التالي" }).click()
    await addFlexibleItem(page, "125")
    await page.getByRole("button", { name: "التالي" }).click()

    const secondUpdateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes(`/dashboard/organization/packages/${packageId}`) &&
        response.ok()
    )
    await page.getByRole("button", { name: "حفظ التغييرات" }).click()
    await secondUpdateResponsePromise

    await expect(
      page.getByText("تم حفظ الباقة، لكن تعذّر رفع الصورة")
    ).toBeVisible()
    await expect(page.getByText("فشل تحديث الباقة")).toHaveCount(0)
    await expect(page).toHaveURL(/\/packages$/)

    await page.goto(`/packages/${packageId}/edit`, {
      waitUntil: "domcontentloaded",
    })
    const editName = page.locator('input[name="nameAr"]')
    await expect(editName).toHaveValue(packageName, { timeout: 20_000 })
    await editName.fill(`${packageName} محدثة`)

    const updateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response
          .url()
        .includes(`/dashboard/organization/packages/${packageId}`) &&
        response.ok()
    )
    await page.getByRole("button", { name: "التالي" }).click()
    await page.getByRole("button", { name: "التالي" }).click()
    await page.getByRole("button", { name: "التالي" }).click()
    await page.getByRole("button", { name: "حفظ التغييرات" }).click()
    await updateResponsePromise

    await expect(page.getByText("تم تحديث الباقة بنجاح")).toBeVisible()
    await expect(page).toHaveURL(/\/packages$/)
  })
})
