/**
 * packages-lifecycle-fixture.ts
 *
 * Shared harness for the dashboard session-packages lifecycle spec. Owns
 * the run-scoped identifier constants + seeded-state container, the full
 * beforeAll seeding chain + afterAll cleanup, and the package-builder +
 * credit-book date-picker UI helpers used by the single serial test in
 * packages-lifecycle.spec.ts. No `test.describe` / top-level `test`
 * registration lives here — the helper is consumed only via its exported
 * lifecycle + UI functions.
 */
import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { getTestTenant } from "../../../fixtures/tenant"
import {
  assignEmployeeToService,
  assignEmployeeToBranch,
  dashboardApiRequest,
  ensurePayAtClinicEnabled,
  ensureValidMainBranchId,
  prepareBookableSchedule,
  seedClient,
  seedEmployee,
  seedService,
  setBranchBusinessHours,
  setEmployeeAvailability,
} from "../../../fixtures/seed"

/** Mutable typed container for the identifiers + run-scoped names shared across
 * the lifecycle's five phases. The spec mutates this in-place from the test body
 * (e.g. `harness.seededPackageId = created.id`) and the helper writes seeded ids
 * back into it from beforeAll. Spec owns run-scoped names; seeded-* are populated by `seedPackagesLifecycleFixtures`. */
export interface PackagesLifecycleHarness {
  token: string
  runId: string
  packageNameAr: string
  clientFirstName: string
  clientLastName: string
  employeeName: string
  seededBranchId: string
  seededEmployeeId: string
  seededServiceId: string
  seededServiceNameAr: string
  seededClientId: string
  seededClientName: string
  seededPackageId: string
  seededPurchaseId: string
  seededBookingId: string
}

/** Escape RegExp metacharacters so a run-scoped literal can be embedded in a `getByRole("option", { name: new RegExp(...) })` matcher. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Best-effort DELETE — never throws, never blocks teardown on a 404/etc. */
function bestEffortDelete(path: string, token: string): Promise<void> {
  return dashboardApiRequest(path, token, { method: "DELETE" }).catch(
    () => undefined,
  )
}

/**
 * Before-all seed: branch (main), client, service + duration option, employee,
 * employee↔service + employee↔branch + business hours + availability +
 * bookable schedule chain. Populates the harness with the seeded ids + names
 * the spec reads across phases. No fixture PATCH against
 * `/dashboard/organization/packages/:id` is performed here — the package
 * creation must go through the UI in the spec to prove the derived-price
 * item builder path (Phase 1).
 */
export async function seedPackagesLifecycleFixtures(
  harness: PackagesLifecycleHarness,
): Promise<void> {
  const t = await getTestTenant()
  harness.token = t.accessToken

  // MAIN branch: the credit-book dialog auto-selects `activeBranches.find((b) => b.isMain)` — a non-main branch would 400 on availability.
  const branch = await ensureValidMainBranchId(harness.token)
  harness.seededBranchId = branch

  const client = await seedClient(harness.token, {
    firstName: harness.clientFirstName,
    lastName: harness.clientLastName,
    gender: "FEMALE",
  })
  harness.seededClientId = client.id
  harness.seededClientName = `${client.firstName} ${client.lastName}`

  // Service with one active IN_PERSON booking type (default) + one matching
  // duration option (15000 halalas = 150 SAR).
  const service = await seedService(harness.token, {
    nameAr: `خدمة الباقة ${harness.runId}`,
    nameEn: `Package Test Service ${harness.runId}`,
    durationMins: 60,
    price: 15000,
  })
  harness.seededServiceId = service.id
  harness.seededServiceNameAr = service.nameAr

  // Duration option so the package item builder's "duration" select has a choice
  // (and book-from-credit's credit row is keyed to it).
  const durRes = await dashboardApiRequest(
    `/dashboard/organization/services/${service.id}/duration-options`,
    harness.token,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options: [{
        label: "جلسة", labelAr: "جلسة", durationMins: 60, price: 15000,
        deliveryType: "IN_PERSON", isDefault: true, isActive: true, sortOrder: 0,
      }] }),
    },
  )
  if (!durRes.ok) {
    throw new Error(
      `[packages-lifecycle] seed duration options failed — HTTP ${durRes.status}: ${await durRes.text().catch(() => "(unreadable)")}`,
    )
  }
  const durs = (await durRes.json()) as Array<{ id: string }>
  if (!durs.length) {
    throw new Error("[packages-lifecycle] seed duration options returned empty list")
  }

  const employee = await seedEmployee(harness.token, {
    name: harness.employeeName,
    gender: "MALE",
  })
  harness.seededEmployeeId = employee.id

  // Wire employee to service + branch with availability — mirrors the lessons-
  // log chain that prevents the booking wizard from returning zero slots.
  await assignEmployeeToService(harness.token, employee.id, service.id).catch(
    () => undefined,
  )
  await setBranchBusinessHours(harness.token, branch)
  await assignEmployeeToBranch(harness.token, branch, employee.id).catch(() => undefined)
  await setEmployeeAvailability(harness.token, employee.id)
  await prepareBookableSchedule(harness.token, { branchId: branch, employeeId: employee.id })

  // No-op for non-pay-at-clinic sells, but safe to call.
  await ensurePayAtClinicEnabled(harness.token).catch(() => undefined)
}

/**
 * Best-effort cleanup — never touch shared rows. Mirrors the original
 * afterAll ordering: refund attempt first, then targeted DELETEs for
 * package, client, service, employee, branch. Each call is wrapped in
 * `.catch(() => undefined)` so a teardown failure on one row doesn't
 * prevent the others from running.
 */
export async function teardownPackagesLifecycleFixtures(
  harness: PackagesLifecycleHarness,
): Promise<void> {
  if (harness.seededPurchaseId) {
    await dashboardApiRequest(
      `/dashboard/finance/package-purchases/${harness.seededPurchaseId}/refund`,
      harness.token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount: 0 }),
      },
    ).catch(() => undefined)
  }
  if (harness.seededPackageId)
    await bestEffortDelete(`/dashboard/organization/packages/${harness.seededPackageId}`, harness.token)
  if (harness.seededClientId)
    await bestEffortDelete(`/dashboard/people/clients/${harness.seededClientId}`, harness.token)
  if (harness.seededServiceId)
    await bestEffortDelete(`/dashboard/organization/services/${harness.seededServiceId}`, harness.token)
  if (harness.seededEmployeeId)
    await bestEffortDelete(`/dashboard/people/employees/${harness.seededEmployeeId}`, harness.token)
  if (harness.seededBranchId)
    await bestEffortDelete(`/dashboard/organization/branches/${harness.seededBranchId}`, harness.token)
}

export interface BuildPackageItemParams {
  serviceNameAr: string
  employeeName: string
}

/**
 * Drive the package item row builder through the REAL ScopeControl +
 * MultiSelect + DurationSelect UI for a single-specific item: service →
 * practitioner → duration, then assert the derived price shows in the row's
 * grid (proves the UI-produced item is the explicit-credit source book-from-
 * credit accepts), and finally fill paidQuantity + freeQuantity. No fixture
 * PATCH may run between this and the subsequent sale POST — doing so would
 * silently fall back to the flexible unit-price path that book-from-credit
 * rejects.
 */
export async function buildPackageItemViaUI(
  page: Page,
  params: BuildPackageItemParams,
): Promise<void> {
  // New item starts with all four scopes in ANY mode (so `#items.0.unitPriceSar`
  // is rendered). Configuring single-specific below swaps that input for a
  // derived-price label — we drive the real ScopeControl + MultiSelect +
  // DurationSelect UI instead of any post-create fixture PATCH.
  const unitPriceInput = page.locator('#items\\.0\\.unitPriceSar')
  await expect(unitPriceInput).toBeVisible({ timeout: 10_000 })

  // ── Service scope: switch الكل → تحديد and pick the seeded service.
  const serviceGroup = page
    .locator('[role="group"][aria-label="الخدمة"]')
    .first()
  await expect(serviceGroup).toBeVisible({ timeout: 10_000 })
  await serviceGroup.getByRole("button", { name: /^تحديد$/ }).click()

  const serviceTrigger = page.locator('#items\\.0\\.service')
  await expect(serviceTrigger).toBeVisible({ timeout: 10_000 })
  await serviceTrigger.click()
  const serviceSearch = page.getByPlaceholder("ابحث عن خدمة...")
  await expect(serviceSearch).toBeVisible({ timeout: 10_000 })
  await serviceSearch.fill(params.serviceNameAr)
  const serviceOption = page
    .getByRole("option", { name: new RegExp(params.serviceNameAr) })
    .first()
  await expect(serviceOption).toBeVisible({ timeout: 10_000 })
  await serviceOption.click()
  // Close the popover so the next click is not intercepted by Radix's outside-pointerdown handler.
  await expect(serviceTrigger).toContainText(params.serviceNameAr, {
    timeout: 5_000,
  })
  await page.keyboard.press("Escape")

  // ── Practitioner scope: switch الكل → تحديد and pick the seeded employee. useServiceEmployees loads the list keyed on the single selected service.
  const practitionerGroup = page
    .locator('[role="group"][aria-label="الممارس"]')
    .first()
  await expect(practitionerGroup).toBeVisible({ timeout: 10_000 })
  await practitionerGroup.getByRole("button", { name: /^تحديد$/ }).click()

  const practitionerTrigger = page.locator('#items\\.0\\.practitioner')
  await expect(practitionerTrigger).toBeVisible({ timeout: 10_000 })
  await practitionerTrigger.click()
  const practitionerSearch = page.getByPlaceholder("ابحث عن ممارس...")
  await expect(practitionerSearch).toBeVisible({ timeout: 10_000 })
  // Practitioner labels are the seeded employee `name` (no user object on the seeded row), so the run-scoped name itself is the visible option.
  await practitionerSearch.fill(params.employeeName)
  const practitionerOption = page
    .getByRole("option", { name: new RegExp(escapeRegex(params.employeeName)) })
    .first()
  await expect(practitionerOption).toBeVisible({ timeout: 10_000 })
  await practitionerOption.click()
  await expect(practitionerTrigger).toContainText(params.employeeName, {
    timeout: 5_000,
  })
  await page.keyboard.press("Escape")

  // ── Duration: visible only once service + practitioner are single-INCLUDE. Pick the seeded IN_PERSON 60-minute / 150 SAR row.
  const durationTrigger = page.locator('#items\\.0\\.duration')
  await expect(durationTrigger).toBeVisible({ timeout: 10_000 })
  await durationTrigger.click()
  const durationOption = page
    .getByRole("option")
    .filter({ hasText: /حضوري.*60.*دقيقة.*150/ })
    .first()
  await expect(durationOption).toBeVisible({ timeout: 10_000 })
  await durationOption.click()
  await expect(durationTrigger).toContainText(/60.*دقيقة/, {
    timeout: 5_000,
  })

  // Single-specific item now: `#items.0.unitPriceSar` MUST be gone (replaced
  // by the derived-price label). The derived-price row shows "150.00", not
  // the placeholder "يُحسب من المدة المختارة" which only renders before a
  // duration is picked.
  await expect(page.locator('#items\\.0\\.unitPriceSar')).toHaveCount(0, {
    timeout: 5_000,
  })
  // The price label sits inside the row's grid that holds paidQuantity + freeQuantity + price — assert the run-scoped price appears in the SAME grid to prove the derived price is wired (not the placeholder).
  const itemGrid = page
    .locator(
      '#items\\.0\\.paidQuantity, #items\\.0\\.freeQuantity, #items\\.0\\.unitPriceSar',
    )
    .first()
    .locator("xpath=ancestor::div[contains(@class,'grid')][1]")
  await expect(itemGrid).toContainText("150.00")

  // ── paidQuantity + freeQuantity — default 1/0 from the row append. Bump paidQuantity to 4 so the credit has room for book-from-credit.
  const paidInput = page.locator('#items\\.0\\.paidQuantity')
  await expect(paidInput).toBeVisible({ timeout: 5_000 })
  await paidInput.fill("4")
  const freeInput = page.locator('#items\\.0\\.freeQuantity')
  await expect(freeInput).toBeVisible({ timeout: 5_000 })
  await freeInput.fill("0")
}

/**
 * Open the DatePicker popover anchored at the given trigger and click the
 * day cell for "tomorrow" (today + 1) — tomorrow is unique in the visible
 * grid because the calendar opens on today's month and the trailing row
 * shows the first few days of next month. The day is read from the DOM via
 * `data-day` (browsers' locale formatter, not Node's), so we enumerate the
 * visible day buttons in JS and find the one matching the target. Throws if
 * the calendar hasn't rendered the target day cell — surfaces a concrete
 * missing-cell error instead of silently clicking the wrong date.
 */
export async function pickCreditBookDateCell(
  page: Page,
  dateTrigger: ReturnType<Page["getByRole"]>,
): Promise<void> {
  await expect(dateTrigger).toBeVisible({ timeout: 10_000 })
  await dateTrigger.click()

  const targetDay = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1) // tomorrow — unique in the visible grid
    return d
  })()
  const targetYear = targetDay.getFullYear()
  const targetMonth = String(targetDay.getMonth() + 1)
  const targetDayNum = String(targetDay.getDate())

  // Brute-force day selection: enumerate every day button, then in JS find the
  // one whose data-day matches the target and click it.
  const cellIndex = await page.evaluate(
    ({ y, m, d }) => {
      const buttons = Array.from(document.querySelectorAll("button[data-day]"))
      // Strip the U+200F RTL marks the ar-SA locale formatter inserts between digits and slashes so data-day matches a plain Western-digit pattern.
      const strip = (s: string) => s.replace(/\u200f/g, "")
      const wantMonth = String(m).padStart(1, "0")
      const wantDay = String(d)
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i]
        const dd = strip(btn.getAttribute("data-day") ?? "")
        // data-day format (after strip): "<day>/<month>/<year>".
        const m1 = dd.match(/^(\d+)\/(\d+)\/(\d{4})$/)
        if (!m1) continue
        const [, cellDay, cellMonth, cellYear] = m1
        if (Number(cellYear) !== y) continue
        if (Number(cellMonth) !== Number(wantMonth)) continue
        if (Number(cellDay) !== Number(wantDay)) continue
        return i
      }
      return -1
    },
    { y: targetYear, m: targetMonth, d: targetDayNum },
  )

  if (cellIndex < 0) {
    throw new Error(
      `[packages-lifecycle] could not find day cell for ${targetYear}-${targetMonth}-${targetDayNum} in the open calendar`,
    )
  }
  const cells = page.locator("button[data-day]")
  await cells.nth(cellIndex).click()
}
