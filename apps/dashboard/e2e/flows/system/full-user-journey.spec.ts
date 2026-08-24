/**
 * Full user journey for the clinic dashboard.
 *
 * This covers the high-value business path as one connected scenario:
 * create service + practitioner + bookable schedule data, create a booking
 * through the dashboard POS, record invoice/payment, then close the booking.
 */
import { expect, test, type Page } from "@playwright/test"
import { expectCurrentPath, expectNoAppCrash } from "../../fixtures/assertions"
import { loginAs } from "../../fixtures/auth"
import { getTestTenant } from "../../fixtures/tenant"
import {
  assignEmployeeToService,
  cleanupBooking,
  cleanupBranch,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  createInvoice,
  createPayment,
  dashboardApiRequest,
  ensureValidMainBranchId,
  prepareBookableSchedule,
  seedClient,
  seedEmployee,
  seedService,
  setServiceBookingTypes,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededInvoice,
  type SeededPayment,
  type SeededService,
} from "../../fixtures/seed"

const SERVICE_PRICE_HALALAS = 28_000
// The dashboard POS creates a pay-at-clinic booking (`payAtClinic: true`),
// so create-booking.handler.ts skips inline invoice creation
// (`if (!dto.payAtClinic && price > 0)`) and the booking-confirmed event
// the BookingConfirmedHandler subscribes to is never fired (create-booking
// emits `bookings.booking.created`, not `bookings.booking.confirmed`).
// The seed's idempotent createInvoice() therefore CREATES the invoice
// here with the requested vatRate=0.15, producing total = 28000 * 1.15
// = 32200 halalas, displayed as 322.00.
const JOURNEY_TOTAL_HALALAS = 32_200
// Match only fully-formed 322.00 / ٣٢٢٫٠٠ representations; a bare `322`
// substring would also match booking numbers, IDs, and unrelated cells, so
// the display assertion is scoped to the complete currency form.
const JOURNEY_TOTAL_AR_OR_EN = /٣٢٢(?:٫|\.)٠٠|322(?:\.|٫)00/

let token = ""
let branchId = ""
let client: SeededClient
let service: SeededService
let employee: SeededEmployee
let booking: SeededBooking | undefined
let invoice: SeededInvoice | undefined
let payment: SeededPayment | undefined

test.beforeAll(async () => {
  const organization = await getTestTenant()
  token = organization.accessToken

  client = await seedClient(token, {
    firstName: "رحلة",
    lastName: `كاملة ${Date.now().toString().slice(-5)}`,
    gender: "FEMALE",
  })

  service = await seedService(token, {
    nameAr: "جلسة رحلة مستخدم",
    nameEn: "Full User Journey Session",
    durationMins: 30,
    price: SERVICE_PRICE_HALALAS,
  })

  employee = await seedEmployee(token, {
    name: `ممارس رحلة ${Date.now().toString().slice(-5)}`,
    gender: "MALE",
  })

  branchId = await ensureValidMainBranchId(token)
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
})

test.afterAll(async () => {
  if (booking?.id) await cleanupBooking(booking.id, token).catch(() => undefined)
  if (employee?.id) await cleanupEmployee(employee.id, token).catch(() => undefined)
  if (service?.id) await cleanupService(service.id, token).catch(() => undefined)
  if (client?.id) await cleanupClient(client.id, token).catch(() => undefined)
  if (branchId) await cleanupBranch(branchId, token).catch(() => undefined)
})

test.describe("Full system user journey", () => {
  test("creates a booking from POS, collects payment, and completes the visit", async ({
    page,
  }) => {
    await loginAs(page, "admin")

    const created = await createBookingFromDashboardPos(page)
    booking = created

    await expectBookingVisibleInList(page, booking.id, clientFullName())

    // Pay-at-clinic bookings skip inline invoice creation, so the seed's
    // createInvoice() CREATES the invoice with the requested vatRate=0.15
    // here (the 409 idempotency path doesn't apply because no auto-invoice
    // exists yet). Total = 28000 * 1.15 = 32200 halalas.
    invoice = await createInvoice(token, {
      bookingId: booking.id,
      branchId,
      clientId: client.id,
      employeeId: employee.id,
      subtotal: SERVICE_PRICE_HALALAS,
      vatRate: 0.15,
      notes: `full journey invoice for ${booking.id}`,
    })
    expect(Number(invoice.total)).toBe(JOURNEY_TOTAL_HALALAS)

    payment = await createPayment(token, {
      invoiceId: invoice.id,
      amount: Number(invoice.total),
      method: "CASH",
      gatewayRef: `full-journey-${booking.id}`,
      idempotencyKey: `full-journey-${booking.id}`,
    })
    expect(payment.status).toBe("COMPLETED")

    await assertInvoiceAndPaymentSurfaces(page)

    await patchBookingStatus(booking.id, "complete")

    await page.goto("/bookings")
    await expectCurrentPath(page, "/bookings")
    await expectNoAppCrash(page)
    // The bookings-list search field is a placeholder-only input
    // (bookings.searchPlaceholder = "بحث بالاسم، رقم الحجز...") with no
    // accessible name, so getByRole('textbox', { name }) never resolves. Target
    // it by placeholder substring (tolerant of the Arabic-comma variant).
    await page
      .getByPlaceholder(/بحث بالاسم|Search by name/i)
      .fill(booking.id)

    const completedRow = page
      .getByRole("row")
      .filter({ hasText: clientFullName() })
      .first()
    await expect(completedRow).toBeVisible({ timeout: 20_000 })
    await expect(completedRow.getByText(/مكتمل|Completed/i)).toBeVisible()
  })
})

async function createBookingFromDashboardPos(page: Page): Promise<SeededBooking> {
  await page.goto("/bookings")
  await expectCurrentPath(page, "/bookings")
  await expectNoAppCrash(page)

  await page.getByRole("button", { name: /حجز جديد|New Booking/i }).click()
  const pos = page.locator(".rounded-2xl.border").filter({
    hasText: /حجز جديد|New Booking/i,
  })
  await expect(pos).toBeVisible({ timeout: 10_000 })

  await pos.locator("input[placeholder*='ابحث'], input[placeholder*='Search']").first().fill(client.lastName)
  await pos.getByRole("button", { name: new RegExp(escapeRegex(clientFullName())) }).click()

  // The unified POS wizard is a strict chain: client → track → department →
  // category → service. After picking the client, the POS auto-opens the track
  // step (CLINICS / GROUP / PACKAGES). Pick CLINICS so the department, category,
  // service sections actually mount. Scope to the track section via its
  // `data-section` attribute so the CLINICS track card can never be confused
  // with the department card — both contain the substring 'عيادات', so a
  // non-scoped locator would resolve to the track card and never click the
  // department.
  const trackCard = pos
    .locator('[data-section="track"]')
    .getByRole("button", { name: /عيادات/ })
    .first()
  await expect(trackCard, "CLINICS track card should be visible").toBeVisible({ timeout: 10_000 })
  await trackCard.click()

  // Department step — same scoping discipline (`data-section="department"`).
  // The seed (fixtures/seed.ts) ensures the clinic department ('عيادات سواء' /
  // 'Sawa Clinics') exists, holds the shared "Test Category", and that the
  // seeded service makes the category bookable — so each WizardCard
  // (`<button disabled={...}>`) is enabled. Assert enabled before clicking so a
  // seed regression fails fast instead of hanging on a disabled card until the
  // suite timeout.
  const departmentCard = pos
    .locator('[data-section="department"]')
    .getByRole("button", { name: /عيادات|clinic/i })
    .first()
  await expect(departmentCard, "clinic department card should be enabled").toBeEnabled({ timeout: 10_000 })
  await departmentCard.click()

  const categoryCard = pos
    .locator("button")
    .filter({ hasText: /فئة اختبار|Test Category/ })
    .first()
  await expect(categoryCard, "test category card should be enabled").toBeEnabled({ timeout: 10_000 })
  await categoryCard.click()

  await pos.getByRole("button", { name: new RegExp(escapeRegex(service.nameAr)) }).click()
  await pos.getByRole("button", { name: new RegExp(escapeRegex(employee.name)) }).click()

  // E2E-CONTRACT: allow-optional-click — delivery type may already be pre-selected; visible only when the service supports multiple delivery modes
  const visibleType = pos.getByText(/حضوري|In-person|IN_PERSON/i).first()
  if (await visibleType.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await expect(visibleType).toBeVisible()
  }

  // E2E-CONTRACT: allow-optional-click — date chips render after employee availability resolves; index 1 picks the next bookable day after today
  const dateButtons = pos.locator("button[class*='min-w-\\[88px\\]']:not([disabled])")
  await expect(dateButtons.first()).toBeVisible({ timeout: 20_000 })
  await dateButtons.nth(1).click()

  const timeButton = pos.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first()
  await expect(timeButton).toBeVisible({ timeout: 20_000 })
  await timeButton.click()

  // Collection-timing radiogroup: after the unified booking POS, the prior
  // 'الدفع في العيادة' toggle is a `<button role="radio">` inside a
  // `role="radiogroup"` (aria-label = `توقيت التحصيل`). The pay-at-clinic option
  // is the default selection — assert it is aria-checked BEFORE we click, so a
  // regression to the prior single-button toggle surfaces immediately instead
  // of silently clicking the wrong element. Scope to the radiogroup inside the
  // POS container so we don't match a same-named radio anywhere else on the
  // page (the bookings-list filter row, the credit/package path, etc.).
  const collectionTimingGroup = pos
    .locator('[role="radiogroup"][aria-label*="التحصيل"]')
    .first()
  await expect(collectionTimingGroup).toBeVisible({ timeout: 10_000 })

  const payAtClinicRadio = collectionTimingGroup.getByRole("radio", {
    name: /الدفع في العيادة|Pay at Clinic/i,
  })
  // Default state — protects the invariant that existing reception bookings
  // keep being invoiced as they are today.
  await expect(payAtClinicRadio).toHaveAttribute("aria-checked", "true", {
    timeout: 5_000,
  })
  await payAtClinicRadio.click()

  const createResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/proxy/dashboard/bookings") &&
      response.request().method() === "POST",
    { timeout: 30_000 }
  )
  await pos.getByRole("button", { name: /تأكيد الحجز|Confirm Booking/i }).click()
  const createResponse = await createResponsePromise
  expect(createResponse.ok()).toBeTruthy()

  const payload = await createResponse.json()
  const created = (payload.data ?? payload) as SeededBooking
  expect(created.id).toBeTruthy()
  expect(created.clientId).toBe(client.id)
  expect(created.serviceId).toBe(service.id)
  expect(created.employeeId).toBe(employee.id)
  return created
}

async function expectBookingVisibleInList(
  page: Page,
  bookingId: string,
  clientName: string
) {
  await page.goto("/bookings")
  await expectCurrentPath(page, "/bookings")
  // Placeholder-only search input (no accessible name) — match by placeholder.
  await page
    .getByPlaceholder(/بحث بالاسم|Search by name/i)
    .fill(bookingId)

  const row = page.getByRole("row").filter({ hasText: clientName }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect(row.getByText(employee.name)).toBeVisible()
  // The redesigned bookings list row shows columns: actions, status, payment
  // status, amount, date, clinic/category, practitioner, patient — but NOT a
  // delivery-type ("زيارة حضورية") badge (that label lives only in the POS
  // wizard / detail / reschedule surfaces). Assert the row's confirmed/pending
  // status instead, which is the meaningful list-level signal.
  await expect(row.getByText(/مؤكد|Confirmed|بالانتظار|Pending/i)).toBeVisible()
}

async function assertInvoiceAndPaymentSurfaces(page: Page) {
  if (!invoice || !payment) throw new Error("Invoice/payment were not created")

  await page.goto("/invoices")
  await expectCurrentPath(page, "/invoices")
  await expectNoAppCrash(page)
  await expect(
    page.getByRole("columnheader", { name: /رقم الفاتورة|Invoice/i })
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: /الإجمالي|Total/i })
  ).toBeVisible()
  await expect(page.getByText(JOURNEY_TOTAL_AR_OR_EN).first()).toBeVisible()

  await page.goto("/payments")
  await expectCurrentPath(page, "/payments")
  await expectNoAppCrash(page)
  const paymentRow = page
    .getByRole("row")
    .filter({ hasText: clientFullName() })
    .first()
  await expect(paymentRow).toBeVisible({ timeout: 20_000 })
  await expect(paymentRow.getByText(/نقدي|Cash/i)).toBeVisible()
  // The payments list renders the COMPLETED status via its i18n label
  // (payment-columns.tsx → PAYMENT_STATUS_KEYS.COMPLETED = "payments.status.paid"
  // → "مدفوع" / "Paid"), NOT the raw enum. Assert the localized label.
  await expect(paymentRow.getByText(/مدفوع|Paid/i).first()).toBeVisible()
  await expect(paymentRow.getByText(JOURNEY_TOTAL_AR_OR_EN).first()).toBeVisible()
}

async function patchBookingStatus(
  bookingId: string,
  action: "confirm" | "complete"
) {
  const response = await dashboardApiRequest(
    `/dashboard/bookings/${bookingId}/${action}`,
    token,
    { method: "PATCH" }
  )
  if (!response.ok) {
    throw new Error(
      `PATCH /dashboard/bookings/${bookingId}/${action} failed: ${response.status} ${await response.text()}`
    )
  }
}

function clientFullName() {
  return `${client.firstName} ${client.lastName}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
