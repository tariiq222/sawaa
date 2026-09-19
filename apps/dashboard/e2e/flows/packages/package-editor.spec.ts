import { test, expect, type Page } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import {
  assignEmployeeToService,
  cleanupEmployee,
  cleanupService,
  dashboardApiRequest,
  seedEmployee,
  seedService,
} from "../../fixtures/seed"
import { getTestTenant } from "../../fixtures/tenant"

type Scope = {
  dimension: string
  mode: string
  targetIds?: string[]
  targets?: { targetId: string }[]
}
type PackageItem = {
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
  unitPrice: number | string | null
  paidQuantity: number
  freeQuantity: number
  constraints?: Scope[]
}
type PackageRecord = { id: string; items: PackageItem[] }
type Duration = { id: string; deliveryType: string; durationMins: number; price: number }

const run = `${Date.now()}`
const createdPackageIds: string[] = []
let token = ""
let serviceA: { id: string; nameAr: string; price: number }
let serviceB: { id: string; nameAr: string; price: number }
let ownerA: { id: string; name: string }
let ownerB: { id: string; name: string }
let durationsA: Duration[]
let durationsB: Duration[]

type JsonResponse = {
  ok: boolean | (() => boolean)
  status: number | (() => number)
  text: () => Promise<string>
  json: () => Promise<unknown>
}

async function json<T>(response: JsonResponse, label: string): Promise<T> {
  const ok = typeof response.ok === "function" ? response.ok() : response.ok
  const status = typeof response.status === "function" ? response.status() : response.status
  if (!ok) throw new Error(`${label} failed with HTTP ${status}: ${await response.text()}`)
  return (await response.json()) as T
}

async function setDurations(serviceId: string, price: number): Promise<Duration[]> {
  const response = await dashboardApiRequest(`/dashboard/organization/services/${serviceId}/duration-options`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: [
      { label: "جلسة قصيرة", labelAr: "جلسة قصيرة", durationMins: 30, price, deliveryType: "IN_PERSON", isDefault: true, isActive: true, sortOrder: 0 },
      { label: "جلسة طويلة", labelAr: "جلسة طويلة", durationMins: 60, price: price + 5000, deliveryType: "IN_PERSON", isDefault: false, isActive: true, sortOrder: 1 },
    ] }),
  })
  return json<Duration[]>(response, `set durations for ${serviceId}`)
}

async function apiPackage(payload: Record<string, unknown>): Promise<PackageRecord> {
  const response = await dashboardApiRequest("/dashboard/organization/packages", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelVersion: "LEGACY", ...payload }),
  })
  const created = await json<PackageRecord>(response, "create package fixture")
  createdPackageIds.push(created.id)
  return created
}

async function readPackage(id: string): Promise<PackageRecord> {
  const response = await dashboardApiRequest(`/dashboard/organization/packages/${id}`, token)
  return json<PackageRecord>(response, `read package ${id}`)
}

function idSelector(path: string) {
  return `[id="${path}"]`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function selectService(page: Page, index: number, optionText: string) {
  const row = page.locator(`[data-package-item="${index}"]`)
  const trigger = row.locator(idSelector(`items.${index}.service`))
  await expect(trigger).toBeVisible()
  await trigger.click()
  const search = page.getByPlaceholder("ابحث عن خدمة...")
  await search.fill(optionText)
  await page.getByRole("option", { name: new RegExp(escapeRegex(optionText)) }).first().click()
  await expect(trigger).toContainText(optionText)
  await page.keyboard.press("Escape")
}

async function chooseFixedService(page: Page, index: number, optionText: string) {
  await selectService(page, index, optionText)
}

async function chooseFlexibleService(page: Page, index: number, optionText: string) {
  const row = page.locator(`[data-package-item="${index}"]`)
  const group = row.getByRole("group", { name: "الخدمة", exact: true })
  await expect(group).toBeVisible()
  await group.getByRole("button", { name: "تحديد", exact: true }).click()
  await selectService(page, index, optionText)
}

async function chooseFixedOwnerItem(page: Page, index: number, serviceName: string) {
  const row = page.locator(`[data-package-item="${index}"]`)
  await row.getByRole("button", { name: /جلسة محددة مسبقاً/ }).click()
  await chooseFixedService(page, index, serviceName)
  const duration = row.locator(idSelector(`items.${index}.duration`))
  await duration.click()
  await page.getByRole("option").filter({ hasText: /حضوري.*30.*دقيقة/ }).first().click()
  await expect(duration).toContainText(/30.*دقيقة/)
}

async function chooseFlexibleItem(page: Page, index: number, serviceName: string) {
  const row = page.locator(`[data-package-item="${index}"]`)
  await row.getByRole("button", { name: /اختيار عند الحجز/ }).click()
  await chooseFlexibleService(page, index, serviceName)
}

async function advance(page: Page) {
  await page.getByRole("button", { name: "التالي", exact: true }).click()
}

async function chooseOwner(page: Page, employeeName: string) {
  await page.getByRole("combobox", { name: "نوع الباقة والممارس المسؤول" }).click()
  await page.getByRole("option", { name: employeeName, exact: true }).click()
}

function normalizeConstraints(item: PackageItem) {
  return (item.constraints ?? [])
    .map((constraint) => ({
      dimension: constraint.dimension,
      mode: constraint.mode,
      targetIds: (constraint.targetIds ?? constraint.targets?.map((target) => target.targetId) ?? []).slice().sort(),
    }))
    .sort((left, right) => `${left.dimension}:${left.mode}`.localeCompare(`${right.dimension}:${right.mode}`))
}

function comparableItem(item: PackageItem) {
  return {
    unitPrice: String(item.unitPrice),
    paidQuantity: item.paidQuantity,
    freeQuantity: item.freeQuantity,
    constraints: normalizeConstraints(item),
  }
}

async function openEditor(page: Page, id?: string) {
  await loginAs(page, "admin")
  await page.goto(id ? `/packages/${id}/edit` : "/packages/create", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: id ? /تعديل الباقة/ : /باقة جلسات جديدة/ })).toBeVisible({ timeout: 20_000 })
}

test.beforeAll(async () => {
  token = (await getTestTenant()).accessToken
  serviceA = await seedService(token, { nameAr: `خدمة محرر أ ${run}`, nameEn: `Editor A ${run}`, durationMins: 30, price: 15_000 })
  serviceB = await seedService(token, { nameAr: `خدمة محرر ب ${run}`, nameEn: `Editor B ${run}`, durationMins: 30, price: 18_000 })
  durationsA = await setDurations(serviceA.id, serviceA.price)
  durationsB = await setDurations(serviceB.id, serviceB.price)
  ownerA = await seedEmployee(token, { name: `مالك أ ${run}`, skipAvailability: true })
  ownerB = await seedEmployee(token, { name: `مالك ب ${run}`, skipAvailability: true })
  await assignEmployeeToService(token, ownerA.id, serviceA.id)
  await assignEmployeeToService(token, ownerA.id, serviceB.id)
  await assignEmployeeToService(token, ownerB.id, serviceA.id)
})

test.afterAll(async () => {
  for (const id of createdPackageIds) await dashboardApiRequest(`/dashboard/organization/packages/${id}`, token, { method: "DELETE" }).catch(() => undefined)
  if (ownerB) await cleanupEmployee(ownerB.id, token).catch(() => undefined)
  if (ownerA) await cleanupEmployee(ownerA.id, token).catch(() => undefined)
  if (serviceB) await cleanupService(serviceB.id, token).catch(() => undefined)
  if (serviceA) await cleanupService(serviceA.id, token).catch(() => undefined)
})

test.describe("package editor phase 3", () => {
  test("creates mixed owner fixed/flexible items, preserves backtracking, and saves only from review", async ({ page }) => {
    const seeded = await apiPackage({
      nameAr: `باقة مختلطة ${run}`,
      ownerEmployeeId: ownerA.id,
      items: [
        { serviceId: serviceA.id, employeeId: ownerA.id, durationOptionId: durationsA[0].id, paidQuantity: 2, freeQuantity: 1, sortOrder: 0 },
        {
          constraints: [
            { dimension: "SERVICE", mode: "ANY" },
            { dimension: "PRACTITIONER", mode: "ANY" },
            { dimension: "DURATION", mode: "ANY" },
          ],
          unitPrice: 9_000,
          paidQuantity: 1,
          freeQuantity: 1,
          sortOrder: 1,
        },
      ],
    })
    await openEditor(page, seeded.id)
    await advance(page)
    // The fixture already contains a valid fixed service/duration row. Keep
    // that hydrated selection and configure only the flexible row below.
    await expect(page.locator(idSelector("items.0.service"))).toContainText(serviceA.nameAr)
    await expect(page.locator(idSelector("items.0.duration"))).toContainText(/30.*دقيقة/)
    await chooseFlexibleItem(page, 1, serviceA.nameAr)
    await advance(page)

    await page.locator(idSelector("items.0.paidQuantity")).fill("2")
    await page.locator(idSelector("items.0.freeQuantity")).fill("1")
    await page.locator(idSelector("items.1.paidQuantity")).fill("1")
    await page.locator(idSelector("items.1.freeQuantity")).fill("1")
    await page.locator(idSelector("items.1.unitPriceSar")).fill("90")
    await page.getByRole("button", { name: "السابق", exact: true }).click()
    await expect(page.locator(idSelector("items.0.duration"))).toContainText(/30.*دقيقة/)
    await advance(page)
    await expect(page.locator(idSelector("items.1.unitPriceSar"))).toHaveValue("90")

    let packageMutations = 0
    page.on("request", (request) => {
      if (request.url().includes("/dashboard/organization/packages") && ["POST", "PATCH", "DELETE"].includes(request.method())) packageMutations++
    })
    await page.locator(idSelector("items.1.unitPriceSar")).press("Enter")
    await expect(page).toHaveURL(new RegExp(`/packages/${seeded.id}/edit`))
    await expect(page.getByRole("button", { name: "التالي", exact: true })).toBeVisible()
    await expect.poll(() => packageMutations, { timeout: 1_500 }).toBe(0)
    await advance(page)
    await expect(page.getByText("مراجعة الباقة", { exact: true })).toBeVisible()
    const review = page.locator("form").first()
    await expect(review).toContainText("الخدمة:")
    await expect(review).toContainText("الممارس:")
    await expect(review).toContainText("المدة:")
    await expect(review).toContainText("نوع الحضور:")
    await expect(review).toContainText("سعر الجلسة:")
    await expect(review).toContainText("السعر النهائي")
    await expect(review).toContainText(serviceA.nameAr)
    await expect(review).toContainText(/30.*دقيقة/)
    await expect(review).toContainText(/150/)
    await expect(review).toContainText(/90/)
    await expect(review).toContainText(/390/)

    const save = page.getByRole("button", { name: "حفظ التغييرات", exact: true })
    const responsePromise = page.waitForResponse((response) => response.url().includes(`/dashboard/organization/packages/${seeded.id}`) && response.request().method() === "PATCH" && response.ok())
    await save.click()
    await responsePromise
    await expect(page).toHaveURL(/\/packages$/)

    await openEditor(page, seeded.id)
    await expect(page.getByRole("combobox", { name: "نوع الباقة والممارس المسؤول" })).toContainText(ownerA.name)
    await advance(page)
    await expect(page.locator(idSelector("items.0.duration"))).toBeVisible()
    await expect(page.locator(`[data-package-item="1"]`).getByRole("button", { name: /اختيار عند الحجز/ })).toBeVisible()
    await advance(page)
    await expect(page.locator(idSelector("items.1.unitPriceSar"))).toHaveValue("90")
    await expect(page.locator(idSelector("items.0.paidQuantity"))).toHaveValue("2")
  })

  test("API-seeded advanced scopes and explicit zero/positive prices survive a no-op save", async ({ page }) => {
    const seeded = await apiPackage({
      nameAr: `باقة قواعد قديمة ${run}`,
      items: [
        {
          constraints: [
            { dimension: "SERVICE", mode: "INCLUDE", targetIds: [serviceA.id] },
            { dimension: "PRACTITIONER", mode: "EXCLUDE", targetIds: [ownerB.id] },
            { dimension: "DURATION", mode: "INCLUDE", targetIds: durationsA.map((duration) => duration.id) },
            { dimension: "DELIVERY_TYPE", mode: "EXCLUDE", targetIds: ["ONLINE"] },
          ],
          unitPrice: 0,
          paidQuantity: 1,
          freeQuantity: 0,
          sortOrder: 0,
        },
        {
          serviceId: serviceA.id,
          employeeId: ownerA.id,
          durationOptionId: durationsA[0].id,
          unitPrice: 17_000,
          paidQuantity: 1,
          freeQuantity: 0,
          sortOrder: 1,
        },
      ],
    })
    const before = await readPackage(seeded.id)
    await openEditor(page, seeded.id)
    await advance(page)
    await advance(page)
    await advance(page)
    await expect(page.getByText("مراجعة الباقة", { exact: true })).toBeVisible()
    const review = page.locator("form").first()
    await expect(review.getByText(/الممارس:\s*عدا(?:\s|:)/)).toBeVisible()
    await expect(review.getByText(/نوع الحضور:\s*عدا(?:\s|:)/)).toBeVisible()
    await page.getByRole("button", { name: "حفظ التغييرات", exact: true }).click()
    await expect(page).toHaveURL(/\/packages$/)
    const after = await readPackage(seeded.id)
    expect(after.items).toHaveLength(before.items.length)
    expect(after.items.map(comparableItem)).toEqual(before.items.map(comparableItem))
  })

  test("owner change clears only the incompatible service and resets its stale price override", async ({ page }) => {
    const seeded = await apiPackage({
      nameAr: `باقة تغيير الملكية ${run}`,
      ownerEmployeeId: ownerA.id,
      items: [
        { serviceId: serviceA.id, employeeId: ownerA.id, durationOptionId: durationsA[0].id, unitPrice: 16_000, paidQuantity: 1, freeQuantity: 0, sortOrder: 0 },
        { serviceId: serviceB.id, employeeId: ownerA.id, durationOptionId: durationsB[0].id, unitPrice: 19_000, paidQuantity: 1, freeQuantity: 0, sortOrder: 1 },
      ],
    })
    await openEditor(page, seeded.id)
    await chooseOwner(page, ownerB.name)
    await advance(page)
    await expect(page.locator(idSelector("items.0.service"))).toContainText(serviceA.nameAr)
    await expect(page.locator(idSelector("items.1.service"))).toContainText("اختر خدمة")

    // The owner change leaves the second fixed row incomplete; Next must block
    // until its compatible replacement is selected.
    await advance(page)
    await expect(page.locator(`[data-package-item="1"]`).getByRole("button", { name: /جلسة محددة مسبقاً/ })).toBeVisible()
    await chooseFixedOwnerItem(page, 1, serviceA.nameAr)
    await advance(page)
    const compatibleReplacement = page.locator(`[data-package-item="1"]`)
    await expect(compatibleReplacement.locator(idSelector("items.1.unitPriceSar"))).not.toBeVisible()
    await expect(compatibleReplacement).toContainText(/150(?:[.,]00)?/)
  })
})
