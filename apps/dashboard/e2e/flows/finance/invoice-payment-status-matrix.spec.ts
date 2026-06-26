/**
 * Invoice/payment status matrix for halala-safe finance flows.
 *
 * Seeds client/service/employee/branch/bookings, creates one unpaid invoice and
 * one partially paid invoice, and asserts exact row-scoped UI amounts. This
 * prevents regressions where integer halalas are rendered as SAR-major numbers
 * without dividing by 100.
 */
import { expect, test, type Page } from "@playwright/test"
import {
  expectCurrentPath,
  expectNoAppCrash,
  rawHalalasPattern,
  sarAmountPattern,
} from "../../fixtures/assertions"
import { loginAs } from "../../fixtures/auth"
import { getTestTenant } from "../../fixtures/tenant"
import {
  cleanupBooking,
  cleanupBranch,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  createInvoice,
  createPayment,
  getInvoice,
  ensureValidBranchId,
  seedBooking,
  seedClient,
  seedEmployee,
  seedService,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededInvoice,
  type SeededPayment,
  type SeededService,
} from "../../fixtures/seed"

const SUBTOTAL_HALALAS = 30_000
const VAT_RATE = 0.15
const TOTAL_HALALAS = 34_500
const PARTIAL_PAYMENT_HALALAS = 10_000

let token = ""
let seededClient: SeededClient
let seededService: SeededService
let seededEmployee: SeededEmployee
let unpaidBooking: SeededBooking
let partialBooking: SeededBooking
let unpaidInvoice: SeededInvoice
let partialInvoice: SeededInvoice
let partialPayment: SeededPayment
let seededClientName = ""
let seededBranchId = ""

test.beforeAll(async () => {
  const tenant = await getTestTenant()
  token = tenant.accessToken

  seededClient = await seedClient(token, {
    firstName: "اختبار",
    lastName: `مصفوفة ${Date.now().toString().slice(-5)}`,
    gender: "FEMALE",
  })
  seededClientName = `${seededClient.firstName} ${seededClient.lastName}`

  seededService = await seedService(token, {
    nameAr: "خدمة مصفوفة مالية",
    nameEn: "Finance Matrix Service",
    durationMins: 45,
    price: SUBTOTAL_HALALAS,
  })

  seededEmployee = await seedEmployee(token, {
    name: "موظف المصفوفة المالية",
    gender: "MALE",
  })

  seededBranchId = await ensureValidBranchId(token)
  unpaidBooking = await seedBooking(token, {
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    scheduledAt: futureRiyadhIso(1, 9),
    payAtClinic: true,
  })
  partialBooking = await seedBooking(token, {
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    scheduledAt: futureRiyadhIso(1, 10),
    payAtClinic: true,
  })

  unpaidInvoice = await createInvoice(token, {
    bookingId: unpaidBooking.id,
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    subtotal: SUBTOTAL_HALALAS,
    vatRate: VAT_RATE,
    notes: `unpaid matrix invoice ${unpaidBooking.id}`,
  })
  partialInvoice = await createInvoice(token, {
    bookingId: partialBooking.id,
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    subtotal: SUBTOTAL_HALALAS,
    vatRate: VAT_RATE,
    notes: `partial matrix invoice ${partialBooking.id}`,
  })

  partialPayment = await createPayment(token, {
    invoiceId: partialInvoice.id,
    amount: PARTIAL_PAYMENT_HALALAS,
    method: "CASH",
  })
})

test.afterAll(async () => {
  // Dashboard finance exposes create/get/list for invoices/payments but no
  // DELETE endpoint. Seeded invoice/payment rows are audit records and are not
  // claimed as cleaned up here.
  if (partialBooking?.id)
    await cleanupBooking(partialBooking.id, token).catch(() => undefined)
  if (unpaidBooking?.id)
    await cleanupBooking(unpaidBooking.id, token).catch(() => undefined)
  if (seededEmployee?.id)
    await cleanupEmployee(seededEmployee.id, token).catch(() => undefined)
  if (seededService?.id)
    await cleanupService(seededService.id, token).catch(() => undefined)
  if (seededClient?.id)
    await cleanupClient(seededClient.id, token).catch(() => undefined)
  if (seededBranchId) await cleanupBranch(seededBranchId, token)
})

test.describe("Finance invoice/payment status matrix", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  test("keeps an invoice DRAFT and unpaid before any payment is recorded", async () => {
    const invoice = await getInvoice(token, unpaidInvoice.id)

    expect(invoice.id).toBe(unpaidInvoice.id)
    expect(invoice.status).toBe("DRAFT")
    expect(Number(invoice.subtotal)).toBe(SUBTOTAL_HALALAS)
    expect(Number(invoice.vatAmt)).toBe(4_500)
    expect(Number(invoice.total)).toBe(TOTAL_HALALAS)
  })

  test("marks an underpaid invoice PARTIALLY_PAID while preserving halala totals", async () => {
    const invoice = await getInvoice(token, partialInvoice.id)

    expect(invoice.id).toBe(partialInvoice.id)
    expect(invoice.status).toBe("PARTIALLY_PAID")
    expect(Number(invoice.total)).toBe(TOTAL_HALALAS)
    expect(Number(partialPayment.amount)).toBe(PARTIAL_PAYMENT_HALALAS)
    expect(partialPayment.status).toBe("COMPLETED")
  })

  test("shows the partial CASH payment row as 100.00 SAR, not raw 10000 halalas", async ({
    page,
  }) => {
    await gotoFinancePage(page, "/payments", /المدفوعات|Payments/i)

    await expect(
      page.getByRole("columnheader", { name: /المستفيد|Client/i })
    ).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: /المبلغ|Amount/i })
    ).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: /الطريقة|Method/i })
    ).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: /الحالة|Status/i })
    ).toBeVisible()

    const paymentRow = page
      .getByRole("row")
      .filter({ hasText: seededClientName })
      .filter({ hasText: paymentListNumber(partialPayment) })
      .first()

    await expect(paymentRow).toBeVisible()
    await expect(
      paymentRow.getByText(sarAmountPattern(PARTIAL_PAYMENT_HALALAS)).first()
    ).toBeVisible()
    await expect(paymentRow.getByText(/نقدي|Cash/i)).toBeVisible()
    // Status renders the localized "payments.status.paid" label
    // (COMPLETED → "مدفوع" / "Paid"), not the raw enum value.
    await expect(paymentRow.getByText(/مدفوع|Paid/i)).toBeVisible()
    await expect(
      paymentRow.getByText(rawHalalasPattern(PARTIAL_PAYMENT_HALALAS))
    ).toHaveCount(0)
  })
})

async function gotoFinancePage(page: Page, path: "/payments", heading: RegExp) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await expectCurrentPath(page, path)
  await expectNoAppCrash(page)
  await expect(
    page.getByRole("heading", { name: heading }).first()
  ).toBeVisible()
}

function futureRiyadhIso(daysFromToday: number, riyadhHour: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + daysFromToday)
  date.setUTCHours(riyadhHour - 3, 0, 0, 0)
  return date.toISOString()
}

function paymentListNumber(payment: SeededPayment) {
  return payment.number
    ? `PAY-${String(payment.number).padStart(4, "0")}`
    : payment.id.slice(0, 8)
}
