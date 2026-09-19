import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { getTestTenant } from "../../../fixtures/tenant"
import {
  assignEmployeeToService,
  cleanupBranch,
  cleanupBooking,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  dashboardApiRequest,
  ensureValidMainBranchId,
  prepareBookableSchedule,
  seedClient,
  seedEmployee,
  seedService,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
} from "../../../fixtures/seed"
const unwrap = <T>(value: unknown): T => value && typeof value === "object" && "data" in value ? (value as { data: T }).data : value as T
export interface GroupedLifecycleHarness {
  token: string
  runId: string
  branchId: string
  client: SeededClient
  scalesService: SeededService
  clinicService: SeededService
  scalesEmployee: SeededEmployee
  clinicEmployee: SeededEmployee
  transferEmployee: SeededEmployee
  scalesDurationId: string
  clinicDurationId: string
  packageId: string
  purchaseId: string
  scaleCreditId: string
  clinicFirstCreditId: string
  clinicSecondCreditId: string
  scalesGroupId: string
  clinicGroupId: string
  bookingIds: string[]
}
export interface CreditSnapshot {
  id: string
  serviceId: string | null
  employeeId: string | null
  totalQuantity: number
  usedQuantity: number
  reservedQuantity: number
  remaining: number
  netValue?: number | null
  sessionPosition?: number | null
  purchaseGroupId?: string | null
}
export interface PurchaseSnapshot {
  id: string
  modelVersion?: string
  credits: CreditSnapshot[]
}
async function readJson<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await dashboardApiRequest(path, token, init)
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`[package-groups-lifecycle] ${init.method ?? "GET"} ${path} failed — HTTP ${response.status}: ${body}`)
  }
  try {
    return unwrap<T>(JSON.parse(body))
  } catch {
    throw new Error(`[package-groups-lifecycle] ${init.method ?? "GET"} ${path} returned invalid JSON: ${body}`)
  }
}
async function durationOption(token: string, serviceId: string, label: string, durationMins: number, price: number): Promise<string> {
  const options = await readJson<Array<{ id: string }>>(
    `/dashboard/organization/services/${serviceId}/duration-options`,
    token,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options: [{ label, labelAr: label, durationMins, price, deliveryType: "IN_PERSON", isDefault: true, isActive: true, sortOrder: 0 }] }),
    },
  )
  if (!options[0]?.id) throw new Error(`[package-groups-lifecycle] duration fixture returned no option for ${serviceId}`)
  return options[0].id
}
export async function fetchClientPurchase(token: string, clientId: string, purchaseId: string): Promise<PurchaseSnapshot> {
  const purchases = await readJson<PurchaseSnapshot[]>(
    `/dashboard/finance/clients/${clientId}/package-purchases?status=ACTIVE`,
    token,
  )
  const purchase = purchases.find((item) => item.id === purchaseId)
  if (!purchase) throw new Error(`[package-groups-lifecycle] purchase ${purchaseId} was absent from the client balance read API`)
  return purchase
}
function findCredit(purchase: PurchaseSnapshot, id: string): CreditSnapshot { const credit = purchase.credits.find((item) => item.id === id); if (!credit) throw new Error(`[package-groups-lifecycle] credit ${id} was absent from purchase ${purchase.id}`); return credit }
export async function seedGroupedLifecycleFixtures(harness: GroupedLifecycleHarness): Promise<void> {
  const tenant = await getTestTenant()
  harness.token = tenant.accessToken
  harness.branchId = await ensureValidMainBranchId(harness.token)
  harness.client = await seedClient(harness.token, {
    firstName: `رحلة باقات ${harness.runId}`,
    lastName: "عميل",
    gender: "FEMALE",
  })
  harness.scalesService = await seedService(harness.token, {
    nameAr: `مقياس الرحلة ${harness.runId}`,
    nameEn: `Lifecycle Scales ${harness.runId}`,
    durationMins: 60,
    price: 15000,
  })
  harness.clinicService = await seedService(harness.token, {
    nameAr: `عيادة الرحلة ${harness.runId}`,
    nameEn: `Lifecycle Clinic ${harness.runId}`,
    durationMins: 45,
    price: 18000,
  })
  harness.scalesEmployee = await seedEmployee(harness.token, { name: `أخصائي المقياس ${harness.runId}` })
  harness.clinicEmployee = await seedEmployee(harness.token, { name: `أخصائي العيادة ${harness.runId}` })
  harness.transferEmployee = await seedEmployee(harness.token, { name: `أخصائي النقل ${harness.runId}` })
  await assignEmployeeToService(harness.token, harness.scalesEmployee.id, harness.scalesService.id)
  await assignEmployeeToService(harness.token, harness.clinicEmployee.id, harness.clinicService.id)
  await assignEmployeeToService(harness.token, harness.transferEmployee.id, harness.clinicService.id)
  harness.scalesDurationId = await durationOption(harness.token, harness.scalesService.id, "جلسة المقياس", 60, 15000)
  harness.clinicDurationId = await durationOption(harness.token, harness.clinicService.id, "جلسة العيادة", 45, 18000)
  await prepareBookableSchedule(harness.token, { branchId: harness.branchId, employeeId: harness.scalesEmployee.id })
  await prepareBookableSchedule(harness.token, { branchId: harness.branchId, employeeId: harness.clinicEmployee.id })
  await prepareBookableSchedule(harness.token, { branchId: harness.branchId, employeeId: harness.transferEmployee.id })
  const packageResult = await readJson<{ id: string }>("/dashboard/organization/packages", harness.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modelVersion: "GROUPED_V2",
      nameAr: `باقة مجموعات الرحلة ${harness.runId}`,
      nameEn: `Grouped lifecycle package ${harness.runId}`,
      groups: [
        {
          key: "scales",
          label: "المقاييس",
          serviceId: harness.scalesService.id,
          employeeId: harness.scalesEmployee.id,
          sequenceMode: "ORDERED",
          dependsOnGroupKey: null,
          sessions: [{ key: "scales-1", position: 0, durationOptionId: harness.scalesDurationId, deliveryType: "IN_PERSON", unitPrice: 15000 }],
        },
        {
          key: "clinic",
          label: "العيادات",
          serviceId: harness.clinicService.id,
          employeeId: harness.clinicEmployee.id,
          sequenceMode: "ORDERED",
          dependsOnGroupKey: "scales",
          sessions: [
            { key: "clinic-1", position: 0, durationOptionId: harness.clinicDurationId, deliveryType: "IN_PERSON", unitPrice: 18000 },
            { key: "clinic-2", position: 1, durationOptionId: harness.clinicDurationId, deliveryType: "IN_PERSON", unitPrice: 18000 },
          ],
        },
      ],
      globalDiscount: { type: "NONE", value: 0 },
    }),
  })
  harness.packageId = packageResult.id
  const sale = await readJson<{ purchase: { id: string } }>("/dashboard/finance/package-purchases", harness.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), packageId: harness.packageId, clientId: harness.client.id, branchId: harness.branchId, method: "CASH" }),
  })
  harness.purchaseId = sale.purchase.id
  const purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
  if (purchase.modelVersion !== "GROUPED_V2" || purchase.credits.length !== 3) {
    throw new Error(`[package-groups-lifecycle] expected GROUPED_V2 purchase with three credits: ${JSON.stringify(purchase)}`)
  }
  const scales = purchase.credits.find((credit) => credit.serviceId === harness.scalesService.id)
  const clinic = purchase.credits.filter((credit) => credit.serviceId === harness.clinicService.id).sort((a, b) => (a.sessionPosition ?? 0) - (b.sessionPosition ?? 0))
  if (!scales || clinic.length !== 2 || !clinic[0] || !clinic[1]) throw new Error("[package-groups-lifecycle] purchase credits did not match the seeded groups")
  harness.scaleCreditId = scales.id
  harness.clinicFirstCreditId = clinic[0].id
  harness.clinicSecondCreditId = clinic[1].id
  harness.scalesGroupId = scales.purchaseGroupId ?? ""
  harness.clinicGroupId = clinic[0].purchaseGroupId ?? ""
  if (!harness.scalesGroupId || !harness.clinicGroupId) throw new Error("[package-groups-lifecycle] grouped purchase credits had no purchaseGroupId")
}
export async function teardownGroupedLifecycleFixtures(harness: GroupedLifecycleHarness): Promise<void> {
  for (const bookingId of harness.bookingIds) await cleanupBooking(bookingId, harness.token).catch(() => undefined)
  if (harness.purchaseId) {
    await dashboardApiRequest(`/dashboard/finance/package-purchases/${harness.purchaseId}/refund`, harness.token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refundAmount: 0 }),
    }).catch(() => undefined)
  }
  if (harness.packageId) await dashboardApiRequest(`/dashboard/organization/packages/${harness.packageId}`, harness.token, { method: "DELETE" }).catch(() => undefined)
  if (harness.client?.id) await cleanupClient(harness.client.id, harness.token).catch(() => undefined)
  for (const service of [harness.scalesService, harness.clinicService]) if (service?.id) await cleanupService(service.id, harness.token).catch(() => undefined)
  for (const employee of [harness.scalesEmployee, harness.clinicEmployee, harness.transferEmployee]) if (employee?.id) await cleanupEmployee(employee.id, harness.token).catch(() => undefined)
  if (harness.branchId) await cleanupBranch(harness.branchId, harness.token).catch(() => undefined)
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
export async function openPackageWizard(page: Page, harness: GroupedLifecycleHarness): Promise<Locator> {
  await page.goto("/bookings", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: /الحجوزات|Bookings/i }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: /حجز جديد|New Booking/i }).click()
  const pos = page.locator(".rounded-2xl.border").filter({ hasText: /حجز جديد|New Booking/i })
  await expect(pos).toBeVisible({ timeout: 10_000 })
  await pos.locator("input[placeholder*='ابحث'], input[placeholder*='Search']").first().fill(harness.client.lastName)
  await pos.getByRole("button", { name: new RegExp(escapeRegex(`${harness.client.firstName} ${harness.client.lastName}`)) }).click()
  await pos.locator('[data-section="track"]').getByRole("button", { name: /باقات|Packages/i }).click()
  await expect(pos.locator('[data-section="package"]')).toBeVisible({ timeout: 10_000 })
  return pos
}
export async function pickGroupedCredit(page: Page, pos: Locator, groupId: string): Promise<void> {
  const group = pos.locator(`[data-testid="package-credit-group-${groupId}"]`)
  await expect(group, `group credit container ${groupId} should be visible`).toBeVisible({ timeout: 15_000 })
  const bookButton = group.getByRole("button", { name: /حجز|Book/i }).first()
  await expect(bookButton, `group credit ${groupId} should expose a book action`).toBeVisible({ timeout: 10_000 })
  await bookButton.click()
}
export async function expectGroupedCreditLocked(pos: Locator, groupId: string): Promise<void> {
  const group = pos.locator(`[data-testid="package-credit-group-${groupId}"]`)
  await expect(group, `locked group credit container ${groupId} should be visible`).toBeVisible({ timeout: 15_000 })
  await expect(group.getByRole("button", { name: /حجز|Book/i })).toHaveCount(0)
  await expect(group.getByRole("status").first(), `group ${groupId} should show its lock reason`).toBeVisible({ timeout: 10_000 })
}
export async function chooseActualDateAndTime(pos: Locator): Promise<void> {
  const datetime = pos.locator('[data-section="datetime"]')
  await expect(datetime).toBeVisible({ timeout: 15_000 })
  const dates = datetime.locator("button[class*='min-w-\\[88px\\]']:not([disabled])")
  const times = datetime.getByRole("button", { name: /^\d{2}:\d{2}$/ })
  const count = await dates.count()
  for (let index = 0; index < count; index += 1) {
    await dates.nth(index).click()
    try {
      await expect.poll(() => times.count(), { timeout: 8_000 }).toBeGreaterThan(0)
      await times.first().click()
      return
    } catch {
      // A day can be enabled while its availability request is still settling;
      // continue to the next real day and fail with a concrete message below.
    }
  }
  throw new Error("[package-groups-lifecycle] datetime UI exposed no bookable date/time slot")
}
export async function submitCreditBooking(page: Page, pos: Locator, creditId: string): Promise<string> {
  const responsePromise = page.waitForResponse((response) => response.url().includes("/from-credit") && response.request().method() === "POST", { timeout: 30_000 })
  const submit = pos.getByRole("button", { name: /تأكيد الحجز|Confirm Booking/i })
  await expect(submit, "credit booking submit control should be available").toBeEnabled({ timeout: 15_000 })
  await submit.click()
  const response = await responsePromise
  const body = await response.text()
  if (!response.ok()) throw new Error(`[package-groups-lifecycle] POST /from-credit failed — HTTP ${response.status()}: ${body}`)
  const booking = unwrap<{ id?: string; packageCreditId?: string }>(JSON.parse(body))
  if (!booking.id || booking.packageCreditId !== creditId) throw new Error(`[package-groups-lifecycle] /from-credit returned the wrong credit: ${body}`)
  return booking.id
}
export async function openBookingDetail(page: Page, harness: GroupedLifecycleHarness, bookingId: string): Promise<Locator> {
  const all = page.getByRole("tab", { name: /^الكل$|^All$/ }).or(page.getByRole("button", { name: /^الكل$|^All$/ })).first()
  if (await all.isVisible({ timeout: 3_000 }).catch(() => false)) await all.click()
  const search = page.getByPlaceholder("بحث بالاسم، رقم الحجز...")
  await expect(search).toBeVisible({ timeout: 10_000 })
  const searchResponsePromise = page.waitForResponse((response) => {
    if (!response.ok() || response.request().method() !== "GET" || !response.url().includes("/dashboard/bookings")) return false
    try {
      return new URL(response.url()).searchParams.get("search") === bookingId
    } catch {
      return false
    }
  }, { timeout: 20_000 })
  await search.fill(bookingId)
  const searchResponse = await searchResponsePromise
  const searchBody = await searchResponse.text().catch(() => "(unreadable body)")
  type ListedBooking = { id: string; bookingNumber?: number; employeeNameSnapshot?: string | null; serviceNameSnapshot?: string | null; employee?: { user?: { firstName?: string; lastName?: string } }; service?: { nameAr?: string; nameEn?: string } }
  let listed: ListedBooking[] = []
  try { listed = unwrap<{ items?: ListedBooking[] }>(JSON.parse(searchBody)).items ?? [] } catch { throw new Error(`[package-groups-lifecycle] booking search response was invalid: ${searchBody.slice(0, 500)}`) }
  const matched = listed.find((item) => item.id === bookingId)
  if (!matched) throw new Error(`[package-groups-lifecycle] booking search response did not contain requested booking ${bookingId}: ${searchBody.slice(0, 500)}`)
  const practitioner = matched.employeeNameSnapshot || [matched.employee?.user?.firstName, matched.employee?.user?.lastName].filter(Boolean).join(" ")
  const service = matched.serviceNameSnapshot || matched.service?.nameAr || matched.service?.nameEn
  const row = page.getByRole("row").filter({ hasText: `#${String(matched.bookingNumber ?? "").padStart(4, "0")}` }).filter({ hasText: practitioner }).first()
  await expect(row, `booking ${bookingId} row should match practitioner ${practitioner}`).toBeVisible({ timeout: 20_000 })
  const rowButton = row.getByRole("button", { name: new RegExp(escapeRegex(`${harness.client.firstName} ${harness.client.lastName}`)) })
  await expect(rowButton).toBeVisible({ timeout: 10_000 })
  await rowButton.click()
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await expect(dialog, `booking ${bookingId} detail should show practitioner ${practitioner}`).toContainText(practitioner)
  if (service) await expect(dialog, `booking ${bookingId} detail should show service ${service}`).toContainText(service)
  return dialog
}
export async function clickReceptionAction(page: Page, dialog: Locator, action: RegExp): Promise<void> {
  const trigger = dialog.getByRole("button", { name: "تغيير الحالة" })
  await expect(trigger, "reception status action trigger should be visible").toBeVisible({ timeout: 10_000 })
  await expect(trigger, "reception status action trigger should be enabled").toBeEnabled({ timeout: 5_000 })
  await trigger.click()
  const item = page.getByRole("menuitem", { name: action })
  await expect(item, `reception action ${action} should be available`).toBeVisible({ timeout: 5_000 })
  await item.click()
}
export async function cancelBookingViaUI(page: Page, dialog: Locator): Promise<void> {
  await clickReceptionAction(page, dialog, /إلغاء الحجز|Cancel booking/i)
  const reason = page.getByRole("combobox").first()
  await expect(reason, "cancel reason control should be available").toBeVisible({ timeout: 5_000 })
  await reason.click()
  await page.getByRole("option").first().click()
  const notes = page.locator("textarea").first()
  await expect(notes, "cancel notes control should be available").toBeVisible({ timeout: 5_000 })
  await notes.fill("package groups lifecycle cancellation")
  const confirm = page.getByRole("button", { name: /إلغاء الحجز|Cancel booking/i }).last()
  await expect(confirm).toBeEnabled({ timeout: 5_000 })
  await confirm.click()
  await expect(confirm).toBeHidden({ timeout: 10_000 })
}
export async function transferCreditViaUI(page: Page, harness: GroupedLifecycleHarness, creditId: string, beforeNetValue: number | null | undefined): Promise<void> {
  await page.goto(`/clients/${harness.client.id}`, { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { name: new RegExp(escapeRegex(`${harness.client.firstName} ${harness.client.lastName}`)) })).toBeVisible({ timeout: 20_000 })
  await page.getByRole("tab", { name: /أرصدة الباقات|Package balances/i }).click()
  const row = page.locator("li").filter({ has: page.getByTestId("credit-transfer-button") }).filter({ hasText: /الجلسة 1|Session 1/ }).filter({ hasText: harness.clinicService.nameAr }).first()
  await expect(row, "the returned first clinic credit row should be transferable").toBeVisible({ timeout: 15_000 })
  await row.getByTestId("credit-transfer-button").click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText(/نقل الرصيد إلى معالج آخر|Transfer credit to another practitioner/i)).toBeVisible({ timeout: 10_000 })
  const target = dialog.locator("#transfer-credit-target")
  await expect(target).toBeVisible({ timeout: 10_000 })
  await target.click()
  await page.getByRole("option", { name: new RegExp(escapeRegex(harness.transferEmployee.name)) }).click()
  const duration = dialog.locator("#transfer-credit-duration")
  await expect(duration, "target duration control should be available for a compatible practitioner").toBeVisible({ timeout: 10_000 })
  await duration.click()
  await page.getByRole("option").filter({ hasText: /45/ }).first().click()
  await dialog.locator("#transfer-credit-reason").fill("تغيير أخصائي الجلسة")
  const submit = dialog.getByRole("button", { name: /نقل الرصيد|Transfer credit/i })
  const responsePromise = page.waitForResponse((response) => response.url().includes(`/credits/${creditId}/transfer`) && response.request().method() === "POST", { timeout: 30_000 })
  await expect(submit).toBeEnabled({ timeout: 10_000 })
  await submit.click()
  const response = await responsePromise
  const body = await response.text()
  if (!response.ok()) throw new Error(`[package-groups-lifecycle] transfer POST failed — HTTP ${response.status()}: ${body}`)
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  const purchase = await fetchClientPurchase(harness.token, harness.client.id, harness.purchaseId)
  const credit = findCredit(purchase, creditId)
  expect(credit.employeeId).toBe(harness.transferEmployee.id)
  expect(credit.netValue).toBe(beforeNetValue)
}
