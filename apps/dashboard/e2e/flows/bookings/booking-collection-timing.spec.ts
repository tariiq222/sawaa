/**
 * booking-collection-timing.spec.ts
 *
 * E2E coverage for the unified booking POS's collection-timing radiogroup
 * (commit 0a9f682a — "feat(dashboard): unify booking POS payment collection").
 * Before the unification the wizard had a single "الدفع في العيادة" boolean
 * toggle; after it, a `<role="radiogroup">` exposes two options — collect-now
 * (تحصيل الآن, payAtClinic=false) and pay-at-clinic (الدفع في العيادة,
 * payAtClinic=true, default). Picking "تحصيل الآن" reveals the shared
 * PaymentMethodPicker; on submit, the wizard's use-booking-pos-submit hook
 * calls createBooking → ensureInvoice → recordPayment in sequence.
 *
 * Covers the four invariants the contract requires:
 *   a. default state of the radiogroup on the CLINICS track.
 *   b. flipping between the two timing options shows/hides the method picker.
 *   c. full happy path — collect-now records the payment server-side and the
 *      booking shows as paid in the bookings list.
 *   d. PACKAGES-track bookings hide the timing group (pre-paid packages).
 *
 * All shared setup + helpers live in `_shared/booking-collection-timing-fixture.ts`
 * so this spec file can stay focused on the four behavioural assertions.
 */
import { expect, test } from "@playwright/test"
import { loginAs } from "../../fixtures/auth"
import { expectCurrentPath } from "../../fixtures/assertions"
import { getTestTenant } from "../../fixtures/tenant"
import {
  capturePaymentMethodFlags,
  enableAllManualPaymentMethods,
  collectionMethodGroup,
  collectionTimingGroup,
  openWizardWithClientAndTrack,
  restorePaymentMethodFlags,
  seedCollectionTimingFixtures,
  teardownCollectionTimingHarness,
  type CollectionTimingHarness,
} from "./_shared/booking-collection-timing-fixture"

// Collect-now coverage needs a finite, integer-priced service so the recorded
// payment's amount is exactly the invoice outstanding (mirroring the createBooking
// → ensureInvoice(outstanding) → recordPayment(amount=outstanding) chain).
const SERVICE_PRICE_HALALAS = 25_000 // 250.00 SAR
// Match ONLY complete 250.00 representations; a bare `250` substring would also
// match unrelated values like "2500.00" or "1,250", so the display assertion
// is scoped to the fully-formed currency form.
const JOURNEY_TOTAL_AR_OR_EN = /٢٥٠(?:٫|\.)٠٠|250(?:\.|٫)00/

const harness: CollectionTimingHarness = {
  token: "",
  branchId: "",
  service: undefined as never,
  employee: undefined as never,
  createdBookings: [],
  createdClientIds: [],
  priorPaymentMethodFlags: undefined,
}

test.beforeAll(async () => {
  // Capture the dashboard API token via the seeded admin user (see
  // apps/dashboard/e2e/fixtures/tenant.ts). The dashboard session itself is
  // bootstrapped by the `setup` project + loginAs beforeEach.
  harness.token = (await getTestTenant()).accessToken

  harness.priorPaymentMethodFlags = await capturePaymentMethodFlags(
    harness.token,
  )
  await enableAllManualPaymentMethods(harness.token)

  const seeded = await seedCollectionTimingFixtures(
    harness.token,
    SERVICE_PRICE_HALALAS,
  )
  harness.branchId = seeded.branchId
  harness.service = seeded.service
  harness.employee = seeded.employee
})

test.afterAll(async () => {
  // Wrap teardown in try/finally so the payment-method flag restore runs
  // EVEN IF teardownCollectionTimingHarness throws. The teardown failure
  // still propagates (re-thrown in the catch) but the org-state restore is
  // guaranteed — a later spec must never inherit mutated payment flags
  // because of a teardown exception in this one.
  let teardownError: unknown
  try {
    await teardownCollectionTimingHarness(harness)
  } catch (err) {
    teardownError = err
  } finally {
    // Restore payment-method flags verbatim. Errors here MUST surface so a
    // later spec doesn't inherit a mutated org state; do not swallow them.
    await restorePaymentMethodFlags(
      harness.token,
      harness.priorPaymentMethodFlags,
    )
  }
  if (teardownError !== undefined) {
    throw new Error(
      `[booking-collection-timing] teardown failed: ${(teardownError as Error)?.message ?? String(teardownError)}`,
    )
  }
})

test.describe("Booking POS — collection-timing radiogroup", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  test("a) radiogroup defaults to pay-at-clinic with both options rendered", async ({
    page,
  }) => {
    const { pos } = await openWizardWithClientAndTrack(
      page,
      harness.token,
      "عيادات",
      harness.createdClientIds,
    )

    const group = collectionTimingGroup(pos)
    await expect(group).toBeVisible({ timeout: 10_000 })

    const collectNow = group.getByRole("radio", { name: /تحصيل الآن|Collect now/i })
    const payAtClinic = group.getByRole("radio", {
      name: /الدفع في العيادة|Pay at Clinic/i,
    })
    await expect(collectNow).toBeVisible()
    await expect(payAtClinic).toBeVisible()

    // Default = pay-at-clinic selected, collect-now deselected.
    await expect(payAtClinic, "pay-at-clinic is the default selection").toHaveAttribute(
      "aria-checked",
      "true",
      { timeout: 5_000 },
    )
    await expect(collectNow, "collect-now is unchecked by default").toHaveAttribute(
      "aria-checked",
      "false",
    )
    await expect(collectionMethodGroup(pos)).toHaveCount(0)
  })

  test("b) selecting collect-now reveals the method radiogroup; pay-at-clinic hides it", async ({
    page,
  }) => {
    const { pos } = await openWizardWithClientAndTrack(
      page,
      harness.token,
      "عيادات",
      harness.createdClientIds,
    )
    const group = collectionTimingGroup(pos)
    await expect(group).toBeVisible({ timeout: 10_000 })

    const collectNow = group.getByRole("radio", { name: /تحصيل الآن|Collect now/i })
    const payAtClinic = group.getByRole("radio", {
      name: /الدفع في العيادة|Pay at Clinic/i,
    })

    await expect(payAtClinic).toHaveAttribute("aria-checked", "true")
    await expect(collectNow).toHaveAttribute("aria-checked", "false")
    await expect(collectionMethodGroup(pos)).toHaveCount(0)

    await collectNow.click()
    await expect(collectNow).toHaveAttribute("aria-checked", "true")
    await expect(payAtClinic).toHaveAttribute("aria-checked", "false")
    const methodGroup = collectionMethodGroup(pos)
    await expect(methodGroup).toBeVisible({ timeout: 5_000 })

    const methodRadios = methodGroup.getByRole("radio")
    await expect
      .poll(() => methodRadios.count(), {
        message: "collect-now should expose exactly four manual payment methods",
      })
      .toBe(4)

    await payAtClinic.click()
    await expect(payAtClinic).toHaveAttribute("aria-checked", "true")
    await expect(collectNow).toHaveAttribute("aria-checked", "false")
    await expect(collectionMethodGroup(pos)).toHaveCount(0)
  })

  test("c) collect-now records a payment and the booking shows as paid", async ({
    page,
  }) => {
    const { pos, clientName } = await openWizardWithClientAndTrack(
      page,
      harness.token,
      "عيادات",
      harness.createdClientIds,
    )

    const departmentCard = pos
      .locator('[data-section="department"]')
      .getByRole("button", { name: /عيادات|clinic/i })
      .first()
    await expect(departmentCard).toBeEnabled({ timeout: 10_000 })
    await departmentCard.click()

    const categoryCard = pos
      .locator("button")
      .filter({ hasText: /فئة اختبار|Test Category/ })
      .first()
    await expect(categoryCard).toBeEnabled({ timeout: 10_000 })
    await categoryCard.click()

    await pos
      .getByRole("button", { name: new RegExp(escapeRegex(clientName)) })
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })

    await pos
      .getByRole("button", { name: new RegExp(escapeRegex(harness.service.nameAr)) })
      .click()
    await pos
      .getByRole("button", { name: new RegExp(escapeRegex(harness.employee.name)) })
      .click()

    // E2E-CONTRACT: allow-optional-click — delivery type may already be
    // pre-selected when only one delivery mode is active.
    const visibleType = pos.getByText(/حضوري|In-person|IN_PERSON/i).first()
    if (await visibleType.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(visibleType).toBeVisible()
    }

    const dateButtons = pos.locator(
      "button[class*='min-w-\\[88px\\]']:not([disabled])",
    )
    await expect(dateButtons.first()).toBeVisible({ timeout: 20_000 })
    await dateButtons.nth(1).click()

    const timeButton = pos.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first()
    await expect(timeButton).toBeVisible({ timeout: 20_000 })
    await timeButton.click()

    const group = collectionTimingGroup(pos)
    await expect(group).toBeVisible({ timeout: 10_000 })
    const collectNow = group.getByRole("radio", {
      name: /تحصيل الآن|Collect now/i,
    })
    await collectNow.click()
    await expect(collectNow).toHaveAttribute("aria-checked", "true")

    const methodGroup = collectionMethodGroup(pos)
    await expect(methodGroup).toBeVisible({ timeout: 5_000 })
    await methodGroup.getByRole("radio", { name: /نقد|Cash/i }).click()

    const bookingCreate = page.waitForResponse(
      (r) =>
        r.url().includes("/api/proxy/dashboard/bookings") &&
        !r.url().includes("/invoice") &&
        !r.url().includes("/cancel") &&
        r.request().method() === "POST",
      { timeout: 30_000 },
    )
    const invoiceCreate = page.waitForResponse(
      (r) =>
        r.url().includes("/api/proxy/dashboard/finance/bookings/") &&
        r.url().includes("/invoice") &&
        r.request().method() === "POST",
      { timeout: 30_000 },
    )
    const paymentCreate = page.waitForResponse(
      (r) =>
        r.url().includes("/api/proxy/dashboard/finance/payments") &&
        r.request().method() === "POST",
      { timeout: 30_000 },
    )

    await pos
      .getByRole("button", { name: /تأكيد الحجز|Confirm Booking/i })
      .click()

    const bookingRes = await bookingCreate
    const invoiceRes = await invoiceCreate
    const paymentRes = await paymentCreate

    expect(bookingRes.ok(), "createBooking must succeed").toBeTruthy()
    expect(invoiceRes.ok(), "ensureInvoice must succeed").toBeTruthy()
    expect(paymentRes.ok(), "recordPayment must succeed").toBeTruthy()

    const invoiceBody = (await invoiceRes.json()) as { id: string; outstanding: number }
    const paymentBody = (await paymentRes.json()) as { invoiceId: string; amount: number }
    expect(paymentBody.invoiceId).toBe(invoiceBody.id)
    expect(Number(paymentBody.amount)).toBe(Number(invoiceBody.outstanding))
    expect(Number(invoiceBody.outstanding)).toBeGreaterThan(0)

    const bookingPayload = (await bookingRes.json()) as
      | { data?: { id: string; clientId: string; scheduledAt: string; status: string } }
      | { id: string; clientId: string; scheduledAt: string; status: string }
    const bookingData =
      "data" in bookingPayload && bookingPayload.data
        ? bookingPayload.data
        : (bookingPayload as {
            id: string
            clientId: string
            scheduledAt: string
            status: string
          })
    expect(bookingData.id, "createBooking response must include an id").toBeTruthy()
    harness.createdBookings.push({
      id: bookingData.id,
      clientId: bookingData.clientId,
      employeeId: harness.employee.id,
      serviceId: harness.service.id,
      scheduledAt: bookingData.scheduledAt ?? new Date().toISOString(),
      status: bookingData.status ?? "CONFIRMED",
    })
    const bookingId = bookingData.id

    await page.goto("/bookings")
    await expectCurrentPath(page, "/bookings")
    await page
      .getByPlaceholder(/بحث بالاسم|Search by name/i)
      .fill(bookingId)
    const row = page.getByRole("row").filter({ hasText: clientName }).first()
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row.getByText(/مدفوع|Paid/i).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(row.getByText(JOURNEY_TOTAL_AR_OR_EN).first()).toBeVisible()
  })

  test("d) PACKAGES track hides the collection-timing radiogroup", async ({
    page,
  }) => {
    const { pos } = await openWizardWithClientAndTrack(
      page,
      harness.token,
      "باقات",
      harness.createdClientIds,
    )

    await expect(collectionTimingGroup(pos)).toHaveCount(0)
    await expect(collectionMethodGroup(pos)).toHaveCount(0)

    await expect(
      pos.locator('[data-section="package"]').first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
