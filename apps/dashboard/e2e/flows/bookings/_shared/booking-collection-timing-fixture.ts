/**
 * booking-collection-timing-fixture.ts
 *
 * Shared harness for the unified booking POS collection-timing spec. Carries
 * the four manual payment-method flags capture/restore lifecycle, the seeded
 * service/employee/branch wiring, and the wizard locator helpers used by all
 * four (a-d) tests in booking-collection-timing.spec.ts.
 *
 * No `test.describe` / top-level `test` registration lives here — the helper
 * is consumed only via its exported lifecycle + locator functions. The spec
 * file owns the four test cases; this module owns the shared boilerplate.
 */
import type { Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { expectCurrentPath, expectNoAppCrash } from "../../../fixtures/assertions"
import {
  assignEmployeeToService,
  cleanupBooking,
  cleanupBranch,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  ensureValidMainBranchId,
  prepareBookableSchedule,
  seedClient,
  seedEmployee,
  seedService,
  setServiceBookingTypes,
  type SeededBooking,
  type SeededEmployee,
  type SeededService,
} from "../../../fixtures/seed"

const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"

/**
 * The four manual payment-method flags the unified POS's PaymentMethodPicker
 * keys off. Capture/restore happens once per spec run — other specs that
 * mutate these flags must do the same. Restored verbatim in afterAll.
 */
export interface PaymentMethodFlagsSnapshot {
  payMethodCashEnabled: boolean
  payMethodBankEnabled: boolean
  payMethodMadaEnabled: boolean
  payMethodTabbyEnabled: boolean
}

export interface CollectionTimingHarness {
  token: string
  branchId: string
  service: SeededService
  employee: SeededEmployee
  createdBookings: SeededBooking[]
  createdClientIds: string[]
  priorPaymentMethodFlags: PaymentMethodFlagsSnapshot | undefined
}

/**
 * Best-effort PATCH against the dashboard API. Mirrors `apiPatch` in
 * bookings-record-payment.spec.ts; propagates non-2xx so callers can surface
 * the exact status + body.
 */
export async function apiPatch(
  path: string,
  bearerToken: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[e2e] PATCH ${path} failed — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

/** Best-effort GET — symmetric with apiPatch. */
export async function apiGet(
  path: string,
  bearerToken: string,
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${bearerToken}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[e2e] GET ${path} failed — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

function isPaymentMethodFlagsSnapshot(value: unknown): value is PaymentMethodFlagsSnapshot {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.payMethodCashEnabled === "boolean" &&
    typeof v.payMethodBankEnabled === "boolean" &&
    typeof v.payMethodMadaEnabled === "boolean" &&
    typeof v.payMethodTabbyEnabled === "boolean"
  )
}

/**
 * Capture the four payment-method flags from /dashboard/organization/settings
 * and validate each one is a real boolean. Throw if the endpoint returns
 * something unexpected — we never want to fall back to `?? false` and
 * accidentally restore a flag we never saw, since that would mutate unknown
 * org state for later specs.
 */
export async function capturePaymentMethodFlags(
  token: string,
): Promise<PaymentMethodFlagsSnapshot> {
  const current = await apiGet(
    "/dashboard/organization/settings",
    token,
  )
  if (!isPaymentMethodFlagsSnapshot(current)) {
    throw new Error(
      `[collection-timing] payment-method flag snapshot malformed: ${JSON.stringify(current)}`,
    )
  }
  return {
    payMethodCashEnabled: current.payMethodCashEnabled,
    payMethodBankEnabled: current.payMethodBankEnabled,
    payMethodMadaEnabled: current.payMethodMadaEnabled,
    payMethodTabbyEnabled: current.payMethodTabbyEnabled,
  }
}

/**
 * Enable all four manual payment methods so the shared PaymentMethodPicker
 * exposes the full radio set across runs. Org state is restored from the
 * snapshot via restorePaymentMethodFlags in afterAll.
 */
export async function enableAllManualPaymentMethods(
  token: string,
): Promise<void> {
  await apiPatch("/dashboard/organization/settings", token, {
    payMethodCashEnabled: true,
    payMethodBankEnabled: true,
    payMethodMadaEnabled: true,
    payMethodTabbyEnabled: true,
  })
}

/**
 * Restore the four manual payment-method flags verbatim. Errors propagate so
 * a restore failure surfaces (Playwright guarantees afterAll runs on success
 * OR failure — silently swallowing here would leave the org mutated for
 * later specs).
 */
export async function restorePaymentMethodFlags(
  token: string,
  snapshot: PaymentMethodFlagsSnapshot | undefined,
): Promise<void> {
  if (!snapshot) return
  await apiPatch("/dashboard/organization/settings", token, snapshot)
}

/**
 * Seed a single finite-priced service + employee on the seeded main branch,
 * with the prerequisite bookable schedule chain. The lifecycle test owns the
 * booking-type and the click path; this helper owns the static wiring.
 */
export async function seedCollectionTimingFixtures(
  token: string,
  servicePriceHalalas: number,
): Promise<{
  branchId: string
  service: SeededService
  employee: SeededEmployee
}> {
  const branchId = await ensureValidMainBranchId(token)
  const service = await seedService(token, {
    nameAr: "خدمة توقيت التحصيل",
    nameEn: "Collection Timing E2E Service",
    durationMins: 30,
    price: servicePriceHalalas,
  })
  const employee = await seedEmployee(token, {
    name: "موظف توقيت التحصيل",
    gender: "MALE",
  })
  await setServiceBookingTypes(token, service.id, [
    {
      deliveryType: "IN_PERSON",
      durationMins: service.durationMins,
      price: service.price,
      isActive: true,
    },
  ])
  await assignEmployeeToService(token, employee.id, service.id)
  await prepareBookableSchedule(token, { branchId, employeeId: employee.id })
  return { branchId, service, employee }
}

/** Best-effort cleanup for the seeded fixtures + the bookings/clients the
 *  spec created during its run. */
export async function teardownCollectionTimingHarness(
  harness: CollectionTimingHarness,
): Promise<void> {
  for (const booking of harness.createdBookings) {
    await cleanupBooking(booking.id, harness.token).catch(() => undefined)
  }
  for (const id of harness.createdClientIds) {
    await cleanupClient(id, harness.token).catch(() => undefined)
  }
  if (harness.employee?.id) {
    await cleanupEmployee(harness.employee.id, harness.token).catch(() => undefined)
  }
  if (harness.service?.id) {
    await cleanupService(harness.service.id, harness.token).catch(() => undefined)
  }
  if (harness.branchId) {
    await cleanupBranch(harness.branchId, harness.token).catch(() => undefined)
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Open the dashboard bookings page, click "حجز جديد", and pick a fresh
 * client plus the chosen track. Returns the POS container locator and the
 * seeded client's full name so the test can scope subsequent assertions
 * to that booking only.
 */
export async function openWizardWithClientAndTrack(
  page: Page,
  token: string,
  trackLabel: "عيادات" | "باقات",
  createdClientIds: string[],
): Promise<{ pos: ReturnType<Page["locator"]>; clientName: string }> {
  const freshClient = await seedClient(token, {
    firstName: "تحصيل",
    lastName: `${trackLabel === "باقات" ? "باقات" : "عيادات"}-${Date.now()
      .toString()
      .slice(-6)}`,
    gender: "FEMALE",
  })
  createdClientIds.push(freshClient.id)
  const clientName = `${freshClient.firstName} ${freshClient.lastName}`

  await page.goto("/bookings")
  await expectCurrentPath(page, "/bookings")
  await expectNoAppCrash(page)

  await page.getByRole("button", { name: /حجز جديد|New Booking/i }).click()
  const pos = page.locator(".rounded-2xl.border").filter({
    hasText: /حجز جديد|New Booking/i,
  })
  await expect(pos).toBeVisible({ timeout: 10_000 })

  await pos
    .locator("input[placeholder*='ابحث'], input[placeholder*='Search']")
    .first()
    .fill(freshClient.lastName)
  await pos
    .getByRole("button", { name: new RegExp(escapeRegex(clientName)) })
    .click()

  const trackCard = pos
    .locator('[data-section="track"]')
    .getByRole("button", { name: new RegExp(escapeRegex(trackLabel)) })
    .first()
  await expect(trackCard).toBeVisible({ timeout: 10_000 })
  await trackCard.click()

  return { pos, clientName }
}

/** Scoped locator for the collection-timing radiogroup inside the POS. */
export function collectionTimingGroup(
  pos: ReturnType<Page["locator"]>,
): ReturnType<Page["locator"]> {
  return pos
    .locator('[role="radiogroup"][aria-label*="التحصيل"]')
    .first()
}

/** Scoped locator for the collection-method radiogroup (collect-now only). */
export function collectionMethodGroup(
  pos: ReturnType<Page["locator"]>,
): ReturnType<Page["locator"]> {
  return pos
    .locator('[role="radiogroup"][aria-label*="طريقة التحصيل"]')
    .first()
}
