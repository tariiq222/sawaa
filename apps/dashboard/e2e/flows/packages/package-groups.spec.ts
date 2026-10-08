import { expect, test } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import { assignEmployeeToService, cleanupEmployee, cleanupService, dashboardApiRequest, seedEmployee, seedService } from "../../fixtures/seed"
import { getTestTenant } from "../../fixtures/tenant"

const run = `${Date.now()}`
let token = ""
let serviceA: { id: string; nameAr: string; price: number }
let serviceB: { id: string; nameAr: string; price: number }
let employeeA: { id: string; name: string }
let employeeB: { id: string; name: string }
let durationA = ""
let durationB = ""
const packageIds: string[] = []

async function createDuration(serviceId: string, price: number, label: string) {
  const response = await dashboardApiRequest(`/dashboard/organization/services/${serviceId}/duration-options`, token, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options: [{ label, labelAr: label, durationMins: 45, price, deliveryType: "IN_PERSON", isDefault: true, isActive: true, sortOrder: 0 }] }) })
  if (!response.ok) throw new Error(`duration fixture failed: ${response.status}`)
  const options = await response.json() as Array<{ id: string }>
  return options[0].id
}

test.describe("grouped package editor", () => {
  test.beforeAll(async () => {
    token = (await getTestTenant()).accessToken
    serviceA = await seedService(token, { nameAr: `مجموعة أ ${run}`, nameEn: `Group A ${run}`, durationMins: 45, price: 15000 })
    serviceB = await seedService(token, { nameAr: `مجموعة ب ${run}`, nameEn: `Group B ${run}`, durationMins: 45, price: 18000 })
    employeeA = await seedEmployee(token, { name: `ممارس أ ${run}`, skipAvailability: true })
    employeeB = await seedEmployee(token, { name: `ممارس ب ${run}`, skipAvailability: true })
    await assignEmployeeToService(token, employeeA.id, serviceA.id)
    await assignEmployeeToService(token, employeeB.id, serviceB.id)
    durationA = await createDuration(serviceA.id, serviceA.price, "جلسة المجموعة أ")
    durationB = await createDuration(serviceB.id, serviceB.price, "جلسة المجموعة ب")
  })

  test.afterAll(async () => {
    for (const id of packageIds) await dashboardApiRequest(`/dashboard/organization/packages/${id}`, token, { method: "DELETE" }).catch(() => undefined)
    if (employeeB) await cleanupEmployee(employeeB.id, token).catch(() => undefined)
    if (employeeA) await cleanupEmployee(employeeA.id, token).catch(() => undefined)
    if (serviceB) await cleanupService(serviceB.id, token).catch(() => undefined)
    if (serviceA) await cleanupService(serviceA.id, token).catch(() => undefined)
  })

  test("starts new packages in the four grouped editor steps", async ({ page }) => {
    await loginAs(page, "admin")
    await page.goto("/packages/create", { waitUntil: "domcontentloaded" })
    await expect(page.locator('input[name="nameAr"]')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("الخدمات والجلسات داخل الباقة", { exact: true })).toHaveCount(0)

    await page.locator('input[name="nameAr"]').fill("باقة اختبار المجموعات")
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.getByRole("heading", { name: "الخدمات والجلسات داخل الباقة", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "إضافة خدمة أو عيادة", exact: true })).toBeVisible()
    await expect(page.getByLabel("الخدمة أو العيادة")).toBeVisible()
    await expect(page.getByLabel("الممارس")).toBeVisible()

    await page.getByRole("button", { name: "إضافة خدمة أو عيادة", exact: true }).click()
    await expect(page.locator("article").nth(1).locator("p").first()).toContainText("الخدمة 2")
    await page.getByRole("button", { name: "حذف الخدمة من الباقة" }).last().click()
    await expect(page.locator("article")).toHaveCount(1)
  })

  test("focuses the first missing details field before any create request", async ({ page }) => {
    await loginAs(page, "admin")
    await page.goto("/packages/create", { waitUntil: "domcontentloaded" })
    let creates = 0
    page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/dashboard/organization/packages")) creates += 1 })
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.locator('input[name="nameAr"]')).toBeFocused()
    expect(creates).toBe(0)
  })

  test("creates mixed groups with independent practitioners and resolved review values", async ({ page }, testInfo) => {
    await loginAs(page, "admin")
    await page.goto("/packages/create", { waitUntil: "domcontentloaded" })
    await page.locator('input[name="nameAr"]').fill(`باقة إنشاء مجموعات ${run}`)
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await page.locator('[id="groups.0.serviceId"]').selectOption(serviceA.id)
    await page.locator('[id="groups.0.employeeId"]').selectOption(employeeA.id)
    await page.locator('[id="groups.0.sessions.0.durationOptionId"]').selectOption(durationA)
    await page.getByRole("button", { name: "إضافة خدمة أو عيادة", exact: true }).click()
    await page.locator('[id="groups.1.serviceId"]').selectOption(serviceB.id)
    await page.locator('[id="groups.1.employeeId"]').selectOption(employeeB.id)
    await page.locator('[id="groups.1.sessions.0.durationOptionId"]').selectOption(durationB)
    const dependency = page.locator('[id="groups.1.dependsOnGroupKey"] option').nth(1)
    await page.locator('[id="groups.1.dependsOnGroupKey"]').selectOption(await dependency.getAttribute("value") ?? "")
    await page.screenshot({ path: testInfo.outputPath("components-editor-desktop.png"), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath("components-editor-mobile.png"), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.getByRole("heading", { name: "مراجعة الباقة", exact: true })).toBeVisible()
    await expect(page.locator("form")).toContainText(serviceA.nameAr)
    await expect(page.locator("form")).toContainText(serviceB.nameAr)
    await expect(page.locator("form")).toContainText(employeeA.name)
    await expect(page.locator("form")).toContainText(employeeB.name)
    await expect(page.locator("form")).toContainText(/45.*دقيقة/)
    await page.screenshot({ path: testInfo.outputPath("grouped-create-review-desktop.png"), fullPage: true })
    const assertNoHorizontalOverflow = async () => expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.setViewportSize({ width: 390, height: 844 })
    await assertNoHorizontalOverflow()
    await page.screenshot({ path: testInfo.outputPath("grouped-create-review-mobile.png"), fullPage: true })
    await page.setViewportSize({ width: 768, height: 900 })
    await assertNoHorizontalOverflow()
    await page.setViewportSize({ width: 1440, height: 900 })
    await assertNoHorizontalOverflow()
    const save = page.locator('form button[type="submit"]')
    await expect(save).toBeVisible()
    const responsePromise = page.waitForResponse((response) => response.url().includes("/dashboard/organization/packages") && response.request().method() === "POST" && response.ok())
    await save.click()
    const createdResponse = await responsePromise
    const created = await createdResponse.json() as { id: string }
    packageIds.push(created.id)
    await expect(page).toHaveURL(/\/packages$/)
  })

  test("saves a single group after the «no dependency» select is focused and left", async ({ page }) => {
    await loginAs(page, "admin")
    await page.goto("/packages/create", { waitUntil: "domcontentloaded" })
    await page.locator('input[name="nameAr"]').fill(`باقة بدون اعتماد ${run}`)
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await page.locator('[id="groups.0.serviceId"]').selectOption(serviceA.id)
    await page.locator('[id="groups.0.employeeId"]').selectOption(employeeA.id)
    await page.locator('[id="groups.0.sessions.0.durationOptionId"]').selectOption(durationA)
    const dependency = page.locator('[id="groups.0.dependsOnGroupKey"]')
    await dependency.focus()
    await dependency.blur()
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.getByRole("heading", { name: "مراجعة الباقة", exact: true })).toBeVisible()
    const requestPromise = page.waitForRequest((request) => request.url().includes("/dashboard/organization/packages") && request.method() === "POST")
    const responsePromise = page.waitForResponse((response) => response.url().includes("/dashboard/organization/packages") && response.request().method() === "POST")
    await page.locator('form button[type="submit"]').click()
    const body = (await requestPromise).postDataJSON() as { groups: Array<{ dependsOnGroupKey: string | null }> }
    expect(body.groups[0].dependsOnGroupKey).toBeNull()
    const response = await responsePromise
    expect(response.ok()).toBe(true)
    packageIds.push((await response.json() as { id: string }).id)
    await expect(page).toHaveURL(/\/packages$/, { timeout: 30_000 })
  })

  test("keeps practitioners and dependency when an existing package is saved after leaving every select", async ({ page }) => {
    const createResponse = await dashboardApiRequest("/dashboard/organization/packages", token, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      modelVersion: "GROUPED_V2",
      nameAr: `باقة تعديل مجموعات ${run}`,
      groups: [
        { key: "first", label: "الأولى", serviceId: serviceA.id, employeeId: employeeA.id, sequenceMode: "ORDERED", dependsOnGroupKey: null, sessions: [{ key: "first-1", position: 0, durationOptionId: durationA, deliveryType: "IN_PERSON", unitPrice: serviceA.price }] },
        { key: "second", label: "الثانية", serviceId: serviceB.id, employeeId: employeeB.id, sequenceMode: "ORDERED", dependsOnGroupKey: "first", sessions: [{ key: "second-1", position: 0, durationOptionId: durationB, deliveryType: "IN_PERSON", unitPrice: serviceB.price }] },
      ],
      globalDiscount: { type: "NONE", value: 0 },
    }) })
    expect(createResponse.ok).toBe(true)
    const { id } = await createResponse.json() as { id: string }
    packageIds.push(id)

    await loginAs(page, "admin")
    await page.goto(`/packages/${id}/edit`, { waitUntil: "domcontentloaded" })
    await expect(page.locator('input[name="nameAr"]')).toHaveValue(`باقة تعديل مجموعات ${run}`)
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.locator('[id="groups.1.dependsOnGroupKey"]')).toHaveValue("first")
    for (const field of ["groups.0.serviceId", "groups.0.employeeId", "groups.0.dependsOnGroupKey", "groups.0.sessions.0.durationOptionId", "groups.1.serviceId", "groups.1.employeeId", "groups.1.dependsOnGroupKey", "groups.1.sessions.0.durationOptionId"]) {
      const select = page.locator(`[id="${field}"]`)
      await select.focus()
      await select.blur()
    }
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    const discountType = page.locator('[id="globalDiscount.type"]')
    await discountType.focus()
    await discountType.blur()
    await page.getByRole("button", { name: "التالي", exact: true }).click()
    await expect(page.getByRole("heading", { name: "مراجعة الباقة", exact: true })).toBeVisible()
    const saveResponse = page.waitForResponse((response) => response.url().includes(`/dashboard/organization/packages/${id}`) && ["PATCH", "PUT"].includes(response.request().method()))
    await page.locator('form button[type="submit"]').click()
    expect((await saveResponse).ok()).toBe(true)
    await expect(page).toHaveURL(/\/packages$/, { timeout: 30_000 })

    const saved = await (await dashboardApiRequest(`/dashboard/organization/packages/${id}`, token)).json() as { groups: Array<{ key: string; employeeId: string; serviceId: string; dependsOnGroupKey: string | null }> }
    const byKey = new Map(saved.groups.map((group) => [group.key, group]))
    expect(byKey.get("first")).toMatchObject({ serviceId: serviceA.id, employeeId: employeeA.id, dependsOnGroupKey: null })
    expect(byKey.get("second")).toMatchObject({ serviceId: serviceB.id, employeeId: employeeB.id, dependsOnGroupKey: "first" })
  })
})
