/**
 * Record-payment flow from the bookings list "unpaid" cell.
 *
 * Drives the dashboard UI through every state of the record-payment dialog:
 *   1. The payment-status cell shows "غير مدفوع / Unpaid" and the amount column
 *      shows the booking price even though no payment exists.
 *   2. Clicking "unpaid" opens the dialog seeded with the outstanding amount.
 *   3. Entering a discount without a reason blocks submission.
 *   4. A cash amount records the payment and flips the cell to "مدفوع / Paid".
 *   5. A discount + reason + cash amount records the payment too.
 *
 * Each test seeds its OWN client + unpaid booking so a recorded (irreversible)
 * payment in one test never collides with the row another test searches for.
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
  type SeededEmployee,
  type SeededService,
} from "../../fixtures/seed"

const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"
const SUBTOTAL_HALALAS = 20_000 // 200 SAR → total 230 SAR with 15% VAT

let token = ""
let branchId = ""
let seededService: SeededService
let seededEmployee: SeededEmployee
const createdBookings: string[] = []
const createdClients: string[] = []

test.beforeAll(async () => {
  const organization = await getTestTenant()
  token = organization.accessToken
  branchId = await ensureValidBranchId(token)

  seededService = await seedService(token, {
    nameAr: "خدمة تسجيل دفعة",
    nameEn: "Record Payment E2E Service",
    durationMins: 45,
    price: SUBTOTAL_HALALAS,
  })
  seededEmployee = await seedEmployee(token, {
    name: "موظف تسجيل الدفعة",
    gender: "MALE",
  })
  await ensureDiscountReason(token)
  // Enable the network (mada) method so the settings-driven button test can see it.
  await apiPatch("/dashboard/organization/settings", token, {
    payMethodCashEnabled: true,
    payMethodMadaEnabled: true,
  }).catch(() => undefined)
})

test.afterAll(async () => {
  for (const id of createdBookings) await cleanupBooking(id, token).catch(() => undefined)
  for (const id of createdClients) await cleanupClient(id, token).catch(() => undefined)
  if (seededEmployee?.id) await cleanupEmployee(seededEmployee.id, token).catch(() => undefined)
  if (seededService?.id) await cleanupService(seededService.id, token).catch(() => undefined)
})

/** Seed a fresh client + unpaid booking + ISSUED invoice; return the client's full name. */
async function seedUnpaidBookingForFreshClient(tag: string): Promise<string> {
  const client = await seedClient(token, {
    firstName: "اختبار",
    lastName: `${tag}${Date.now().toString().slice(-5)}`,
    gender: "FEMALE",
  })
  createdClients.push(client.id)

  const booking = await seedBooking(token, {
    branchId,
    clientId: client.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    payAtClinic: true,
  })
  createdBookings.push(booking.id)

  await apiPost("/dashboard/finance/invoices", token, {
    bookingId: booking.id,
    branchId,
    clientId: client.id,
    employeeId: seededEmployee.id,
    subtotal: SUBTOTAL_HALALAS,
    vatRate: 0.15,
    notes: `e2e record-payment invoice for ${booking.id}`,
  })
  return `${client.firstName} ${client.lastName}`
}

test.describe("Bookings - record payment from the unpaid cell", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  test("unpaid booking shows the Unpaid badge and the price in the amount column", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("badge")
    const row = await findSeededRow(page, name)

    await expect(row.getByText(/غير مدفوع|Unpaid/i)).toBeVisible()
    await expect(row.getByText(/٢٠٠|200/).first()).toBeVisible()
  })

  test("clicking Unpaid opens the dialog seeded with the outstanding total (230)", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("open")
    const row = await findSeededRow(page, name)

    // The Unpaid badge is a button that opens the record-payment dialog.
    await row.getByRole("button", { name: /تسجيل دفعة|Record payment/i }).click()
    const dialog = page.getByRole("dialog").first()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/٢٣٠|230/).first()).toBeVisible()
  })

  test("shows payment-method buttons, including the network method enabled in settings", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("methods")
    const row = await findSeededRow(page, name)
    await row.getByRole("button", { name: /تسجيل دفعة|Record payment/i }).click()

    const dialog = page.getByRole("dialog").first()
    await expect(dialog.getByRole("radio", { name: /نقد|Cash/i })).toBeVisible()
    // mada was enabled in beforeAll; its button must render.
    await expect(dialog.getByRole("radio", { name: /شبكة|Network|mada/i })).toBeVisible()
  })

  test("entering a discount without a reason keeps the submit button disabled", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("disc")
    const row = await findSeededRow(page, name)
    await row.getByRole("button", { name: /تسجيل دفعة|Record payment/i }).click()

    const dialog = page.getByRole("dialog").first()
    await dialog.getByLabel(/خصم|Discount/i).first().fill("20")

    await expect(
      dialog.getByRole("button", { name: /تسجيل الدفعة|Record payment/i }),
    ).toBeDisabled()
    // The discount-reason field appears once a discount is entered. Target the
    // <label> by its `for` attribute to avoid matching the placeholder text too.
    await expect(dialog.locator("label[for='pay-discount-reason']")).toBeVisible()
  })

  test("recording a cash payment flips the cell to Paid", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("cash")
    const row = await findSeededRow(page, name)
    await row.getByRole("button", { name: /تسجيل دفعة|Record payment/i }).click()

    const dialog = page.getByRole("dialog").first()
    await expect(dialog).toBeVisible()

    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/dashboard/finance/payments") && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: /تسجيل الدفعة|Record payment/i }).click(),
    ])
    expect(res.ok()).toBeTruthy()
    // The successful POST closes the dialog; the cache invalidation then flips the
    // cell. Assert within the already-loaded list (the row is in view) — re-running
    // the full nav+search risks exceeding the test timeout.
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    const paidRow = page.getByRole("row").filter({ hasText: name }).first()
    await expect(paidRow.getByText(/مدفوع|Paid/i)).toBeVisible({ timeout: 15_000 })
  })

  test("recording a payment with a discount + reason succeeds", async ({ page }) => {
    const name = await seedUnpaidBookingForFreshClient("dr")
    const row = await findSeededRow(page, name)
    await row.getByRole("button", { name: /تسجيل دفعة|Record payment/i }).click()

    const dialog = page.getByRole("dialog").first()
    await dialog.getByLabel(/خصم|Discount/i).first().fill("30")

    // Open the reason combobox and pick the first option.
    await dialog.getByRole("combobox").last().click()
    await page.getByRole("option").first().click()

    const [discountRes, paymentRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/discount") && r.request().method() === "PATCH"),
      page.waitForResponse(
        (r) => r.url().includes("/dashboard/finance/payments") && r.request().method() === "POST",
      ),
      dialog.getByRole("button", { name: /تسجيل الدفعة|Record payment/i }).click(),
    ])
    expect(discountRes.ok()).toBeTruthy()
    expect(paymentRes.ok()).toBeTruthy()
    await expect(dialog).toBeHidden({ timeout: 10_000 })
    const paidRow = page.getByRole("row").filter({ hasText: name }).first()
    await expect(paidRow.getByText(/مدفوع|Paid/i)).toBeVisible({ timeout: 15_000 })
  })
})

/** Navigate to bookings, switch to "all", search by client name, return the row. */
async function findSeededRow(page: Page, clientName: string) {
  await page.goto("/bookings", { waitUntil: "domcontentloaded" })
  await expectCurrentPath(page, "/bookings")
  await expectNoAppCrash(page)
  await expect(page.getByRole("heading", { name: /الحجوزات|Bookings/i }).first()).toBeVisible()

  const allTab = page
    .getByRole("tab", { name: /^الكل$|^All$/ })
    .or(page.getByRole("button", { name: /^الكل$|^All$/ }))
    .first()
  await expect(allTab).toBeVisible({ timeout: 10_000 })
  await allTab.click()
  // Let the "all" re-fetch settle before typing, so the input isn't remounted
  // mid-keystroke (which silently drops the typed value).
  await page.waitForResponse(
    (r) => r.url().includes("/bookings") && r.request().method() === "GET" && r.ok(),
  ).catch(() => {})

  const search = page.getByPlaceholder(/بحث|Search/i).first()
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.click()
  await search.fill(clientName)
  // Assert the value actually landed before waiting on the debounced fetch.
  await expect(search).toHaveValue(clientName)
  // Wait for the debounced, filtered re-fetch (URL carries the search term).
  await page.waitForResponse(
    (r) =>
      r.url().includes("/bookings") &&
      r.url().includes("search=") &&
      r.request().method() === "GET" &&
      r.ok(),
  ).catch(() => {})

  const row = page.getByRole("row").filter({ hasText: clientName }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  return row
}

let reasonEnsured = false
async function ensureDiscountReason(bearerToken: string) {
  if (reasonEnsured) return
  reasonEnsured = true
  await apiPost("/dashboard/discount-reasons", bearerToken, {
    labelAr: `خصم اختبار ${Date.now().toString().slice(-5)}`,
  }).catch(() => undefined)
}

async function apiPost(path: string, bearerToken: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[e2e] POST ${path} failed — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function apiPatch(path: string, bearerToken: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[e2e] PATCH ${path} failed — HTTP ${res.status}: ${text}`)
  }
  return res.json()
}
