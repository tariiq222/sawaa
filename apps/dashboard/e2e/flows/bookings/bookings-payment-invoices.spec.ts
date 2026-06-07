/**
 * Payment and invoice assertions for the bookings finance trail.
 *
 * This spec seeds one pay-at-clinic booking, creates its invoice through the
 * dashboard finance API, records a CASH payment, then verifies the UI surfaces
 * that exact seeded booking/payment/invoice instead of accepting page-body smoke.
 */
import { expect, test, type Page } from "@playwright/test"
import { expectCurrentPath, expectNoAppCrash } from "../../fixtures/assertions"
import { loginAs } from "../../fixtures/auth"
import { getTestTenant } from "../../fixtures/tenant"
import {
  cleanupBooking,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  ensureValidBranchId,
  seedBooking,
  seedClient,
  seedEmployee,
  seedService,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededService,
} from "../../fixtures/seed"

const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"
const CASH_SUBTOTAL_HALALAS = 30_000
const EXPECTED_TOTAL_HALALAS = 34_500
const EXPECTED_TOTAL_AR_OR_EN = /٣٤٥(?:٫|\.)٠٠|345(?:\.|٫)00|345/

type SeededInvoice = {
  id: string
  number?: number
  subtotal: number | string
  vatAmt: number | string
  total: number | string
}

type SeededPayment = {
  id: string
  number?: number
  invoiceId: string
  amount: number | string
  method: string
  status: string
}

let token = ""
let seededClient: SeededClient
let seededService: SeededService
let seededEmployee: SeededEmployee
let seededBooking: SeededBooking
let seededInvoice: SeededInvoice
let seededPayment: SeededPayment
let seededClientName = ""

test.beforeAll(async () => {
  const organization = await getTestTenant()
  token = organization.accessToken

  seededClient = await seedClient(token, {
    firstName: "اختبار",
    lastName: `دفع ${Date.now().toString().slice(-5)}`,
    gender: "FEMALE",
  })
  seededClientName = `${seededClient.firstName} ${seededClient.lastName}`

  seededService = await seedService(token, {
    nameAr: "خدمة دفع نقدي",
    nameEn: "Cash Payment E2E Service",
    durationMins: 45,
    price: CASH_SUBTOTAL_HALALAS,
  })

  seededEmployee = await seedEmployee(token, {
    name: "موظف الدفع النقدي",
    gender: "MALE",
  })

  const branchId = await ensureValidBranchId(token)
  seededBooking = await seedBooking(token, {
    branchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    payAtClinic: true,
  })

  seededInvoice = await apiPost<SeededInvoice>(
    "/dashboard/finance/invoices",
    token,
    {
      bookingId: seededBooking.id,
      branchId,
      clientId: seededClient.id,
      employeeId: seededEmployee.id,
      subtotal: CASH_SUBTOTAL_HALALAS,
      vatRate: 0.15,
      notes: `e2e cash invoice for ${seededBooking.id}`,
    }
  )

  expect(Number(seededInvoice.total)).toBe(EXPECTED_TOTAL_HALALAS)

  seededPayment = await apiPost<SeededPayment>(
    "/dashboard/finance/payments",
    token,
    {
      invoiceId: seededInvoice.id,
      amount: Number(seededInvoice.total),
      method: "CASH",
      gatewayRef: `e2e-cash-${seededBooking.id}`,
      idempotencyKey: `e2e-cash-${seededBooking.id}`,
    }
  )
})

test.afterAll(async () => {
  if (seededBooking?.id)
    await cleanupBooking(seededBooking.id, token).catch(() => undefined)
  if (seededEmployee?.id)
    await cleanupEmployee(seededEmployee.id, token).catch(() => undefined)
  if (seededService?.id)
    await cleanupService(seededService.id, token).catch(() => undefined)
  if (seededClient?.id)
    await cleanupClient(seededClient.id, token).catch(() => undefined)
})

test.describe("Bookings - payment and invoice finance trail", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  test("shows the seeded booking payment status, method, and amount in its detail sheet", async ({
    page,
  }) => {
    const dialog = await openSeededBookingDetail(page)

    await expect(dialog.getByText(seededClientName)).toBeVisible()
    await expect(dialog.getByText(seededService.nameAr)).toBeVisible()
    await expect(dialog.getByText(/^(الدفع|Payment)$/i)).toBeVisible()
    await expect(dialog.getByText(/مدفوع|Paid/i)).toBeVisible()
    await expect(dialog.getByText(/نقداً|Cash/i)).toBeVisible()
    await expect(
      dialog.getByText(EXPECTED_TOTAL_AR_OR_EN).first()
    ).toBeVisible()

    // Current booking detail UI does not expose an in-dialog cash collection action;
    // it renders the completed finance trail once CASH is recorded.
    await expect(dialog.getByRole("button", { name: /دفع|Pay/i })).toHaveCount(
      0
    )
  })

  test("documents current booking invoice action state and verifies the invoice list row", async ({
    page,
  }) => {
    const dialog = await openSeededBookingDetail(page)

    // Current UI has no invoice action inside booking details; the invoice surface
    // is the dedicated /invoices list backed by payment rows.
    await expect(
      dialog.getByRole("button", { name: /فاتورة|Invoice/i })
    ).toHaveCount(0)

    await gotoFinancePage(page, "/invoices", /الفواتير|Invoices/i)
    await expect(
      page.getByRole("columnheader", { name: /رقم الفاتورة|Invoice/i })
    ).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: /الإجمالي|Total/i })
    ).toBeVisible()
    const invoiceRow = page
      .getByRole("row")
      .filter({ hasText: invoiceListNumber() })
      .first()
    await expect(invoiceRow).toBeVisible()
    await expect(
      invoiceRow.getByText(EXPECTED_TOTAL_AR_OR_EN).first()
    ).toBeVisible()
  })

  test("shows the seeded cash payment on the payments list with strong table assertions", async ({
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
      .first()
    await expect(paymentRow).toBeVisible()
    await expect(
      paymentRow.getByText(EXPECTED_TOTAL_AR_OR_EN).first()
    ).toBeVisible()
    await expect(paymentRow.getByText(/نقدي|Cash/i)).toBeVisible()
    await expect(paymentRow.getByText("COMPLETED")).toBeVisible()
  })

  test("method filter narrows payments to the seeded cash payment without body fallbacks", async ({
    page,
  }) => {
    await gotoFinancePage(page, "/payments", /المدفوعات|Payments/i)

    await page
      .getByRole("combobox")
      .filter({ hasText: /جميع الطرق|All Methods/i })
      .click()
    await page.getByRole("option", { name: /نقدي|Cash/i }).click()

    await expect(
      page.getByRole("row").filter({ hasText: seededClientName })
    ).toBeVisible()
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: /نقدي|Cash/i })
        .first()
    ).toBeVisible()
  })
})

async function openSeededBookingDetail(page: Page) {
  await gotoFinancePage(page, "/bookings", /الحجوزات|Bookings/i)

  await expect(
    page.getByRole("columnheader", { name: /المريض|Client/i })
  ).toBeVisible()
  await expect(
    page.getByRole("columnheader", { name: /حالة الدفع|Payment Status/i })
  ).toBeVisible()
  // Seeded bookings are future-dated, so switch off the default "today" filter
  // to the "all" tab before searching. Wait for the list re-fetch to settle.
  const allTab = page
    .getByRole("tab", { name: /^الكل$|^All$/ })
    .or(page.getByRole("button", { name: /^الكل$|^All$/ }))
    .first()
  await expect(allTab).toBeVisible({ timeout: 10_000 })
  await Promise.all([
    page
      .waitForResponse(
        (r) =>
          r.url().includes("/bookings") &&
          r.request().method() === "GET" &&
          r.ok()
      )
      .catch(() => {}),
    allTab.click(),
  ])

  // Search by client name — the bookings search matches client name / phone /
  // booking-number server-side (debounced 300ms). Target by placeholder (robust
  // whether or not the input exposes an accessible name), then wait for the
  // debounced filtered re-fetch to settle before locating the row.
  const search = page.getByPlaceholder(/بحث|Search/i).first()
  await expect(search).toBeVisible({ timeout: 15_000 })
  await Promise.all([
    page
      .waitForResponse(
        (r) =>
          r.url().includes("/bookings") &&
          r.request().method() === "GET" &&
          r.ok()
      )
      .catch(() => {}),
    search.fill(seededClientName),
  ])

  // The filtered list re-renders (the row briefly unmounts during the re-fetch),
  // so target the row by text — Playwright auto-retries until it settles — then
  // click the client button inside it. Matching the row (not a button accessible
  // name assembled from avatar + name + booking number) is the robust anchor.
  const seededRow = page
    .getByRole("row")
    .filter({ hasText: seededClientName })
    .first()
  await expect(seededRow).toBeVisible({ timeout: 20_000 })
  await seededRow
    .getByRole("button", { name: new RegExp(escapeRegex(seededClientName)) })
    .first()
    .click()

  const dialog = page
    .getByRole("dialog")
    .filter({ hasText: seededClientName })
    .first()
  await expect(dialog).toBeVisible()
  return dialog
}

async function gotoFinancePage(
  page: Page,
  path: "/bookings" | "/payments" | "/invoices",
  heading: RegExp
) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  await expectCurrentPath(page, path)
  await expectNoAppCrash(page)
  await expect(
    page.getByRole("heading", { name: heading }).first()
  ).toBeVisible()
}

async function apiPost<T>(
  path: string,
  bearerToken: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[e2e] POST ${path} failed — HTTP ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

function invoiceListNumber() {
  // The invoices list renders `INV-<invoice.number>` (see use-invoices.ts), not
  // the payment number — these are independent sequences.
  return seededInvoice.number
    ? `INV-${String(seededInvoice.number).padStart(4, "0")}`
    : seededInvoice.id.slice(0, 8).toUpperCase()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
