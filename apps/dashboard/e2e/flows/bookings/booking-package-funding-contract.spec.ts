/**
 * Contract coverage for the booking list/detail distinction between:
 * - a normally payable individual booking,
 * - a prepaid session-package credit booking, and
 * - a group-program enrollment.
 *
 * The data is API-seeded because the assertions exercise the booking UI, not
 * the unrelated package-sale and program-creation forms. Every row receives a
 * run-specific name and teardown addresses only IDs created by this spec.
 */
import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { expectCurrentPath, expectNoAppCrash } from "../../fixtures/assertions"
import { loginAs } from "../../fixtures/auth"
import {
  cleanupBooking,
  cleanupClient,
  cleanupEmployee,
  cleanupProgram,
  cleanupService,
  dashboardApiRequest,
  ensureValidBranchId,
  seedBooking,
  seedClient,
  seedEmployee,
  seedProgram,
  seedService,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededProgram,
  type SeededService,
} from "../../fixtures/seed"
import { getTestTenant } from "../../fixtures/tenant"

type CreatedPackage = { id: string }
type CreatedCategory = { id: string }
type CreatedPurchase = { purchase: { id: string } }
type CreatedBooking = { id: string }

const runId = `pkg-funding-${Date.now().toString(36)}`
const packageNameAr = `باقة خصم ${runId}`

let token = ""
let branchId = ""
let employee: SeededEmployee
let service: SeededService
let normalClient: SeededClient
let packageClient: SeededClient
let groupClient: SeededClient
let normalBooking: SeededBooking
let packageBooking: CreatedBooking
let groupProgram: SeededProgram
let packageId = ""
let purchaseId = ""
let categoryId = ""

test.beforeAll(async () => {
  token = (await getTestTenant()).accessToken
  branchId = await ensureValidBranchId(token)

  employee = await seedEmployee(token, {
    name: `ممارس ${runId}`,
    gender: "MALE",
  })
  categoryId = (
    await postJson<CreatedCategory>("/dashboard/organization/categories", {
      nameAr: `فئة ${runId}`,
      nameEn: `Category ${runId}`,
    })
  ).id
  service = await seedService(token, {
    nameAr: `خدمة ${runId}`,
    nameEn: `Package funding ${runId}`,
    durationMins: 60,
    price: 15_000,
    categoryId,
  })

  normalClient = await seedClient(token, {
    firstName: "عادي",
    lastName: runId,
    gender: "FEMALE",
  })
  packageClient = await seedClient(token, {
    firstName: "باقة",
    lastName: runId,
    gender: "FEMALE",
  })
  groupClient = await seedClient(token, {
    firstName: "جماعي",
    lastName: runId,
    gender: "FEMALE",
  })

  // Pay-at-clinic gives the ordinary booking a real outstanding amount and
  // therefore the normal "record payment" affordance.
  normalBooking = await seedBooking(token, {
    branchId,
    clientId: normalClient.id,
    employeeId: employee.id,
    serviceId: service.id,
    payAtClinic: true,
  })

  const durationOption = await putJson<Array<{ id: string }>>(
    `/dashboard/organization/services/${service.id}/duration-options`,
    {
      options: [
        {
          label: "جلسة",
          labelAr: "جلسة",
          durationMins: 60,
          price: 15_000,
          deliveryType: "IN_PERSON",
          isDefault: true,
          isActive: true,
          sortOrder: 0,
        },
      ],
    }
  )
  const durationOptionId = durationOption[0]?.id
  if (!durationOptionId) {
    throw new Error(
      "[booking-package-funding] duration-option seed returned no id"
    )
  }

  const createdPackage = await postJson<CreatedPackage>(
    "/dashboard/organization/packages",
    {
      nameAr: packageNameAr,
      nameEn: `Package funding ${runId}`,
      isActive: true,
      isPublic: false,
      items: [
        {
          serviceId: service.id,
          employeeId: employee.id,
          durationOptionId,
          paidQuantity: 1,
          freeQuantity: 0,
          sortOrder: 0,
        },
      ],
    }
  )
  packageId = createdPackage.id

  const createdPurchase = await postJson<CreatedPurchase>(
    "/dashboard/finance/package-purchases",
    {
      idempotencyKey: randomUUID(),
      packageId,
      clientId: packageClient.id,
      branchId,
      employeeId: employee.id,
      method: "CASH",
      notes: `e2e ${runId}`,
    }
  )
  purchaseId = createdPurchase.purchase.id

  // seedBooking prepared the same employee/branch availability; moving one
  // day avoids its occupied normal-booking slot while retaining a real future
  // time accepted by book-from-credit.
  const packageScheduledAt = new Date(normalBooking.scheduledAt)
  packageScheduledAt.setUTCDate(packageScheduledAt.getUTCDate() + 1)
  packageBooking = await postJson<CreatedBooking>(
    "/dashboard/bookings/from-credit",
    {
      clientId: packageClient.id,
      serviceId: service.id,
      employeeId: employee.id,
      durationOptionId,
      branchId,
      scheduledAt: packageScheduledAt.toISOString(),
      deliveryType: "IN_PERSON",
    }
  )

  groupProgram = await seedProgram(token, {
    branchId,
    supervisorIds: [employee.id],
    nameAr: `برنامج جماعي ${runId}`,
    nameEn: `Group ${runId}`,
    minParticipants: 1,
    maxParticipants: 5,
    priceHalalas: 0,
  })
  await patchJson(`/dashboard/programs/${groupProgram.id}/publish`, {})
  await postJson(`/dashboard/programs/${groupProgram.id}/enrollments`, {
    clientId: groupClient.id,
  })
})

test.afterAll(async () => {
  // The credit booking must be cancelled before refunding its purchase so the
  // credit is returned; all cleanup targets are IDs created above.
  if (packageBooking?.id)
    await cleanupBooking(packageBooking.id, token).catch(() => undefined)
  if (normalBooking?.id)
    await cleanupBooking(normalBooking.id, token).catch(() => undefined)
  if (groupProgram?.id)
    await cleanupProgram(groupProgram.id, token).catch(() => undefined)
  if (purchaseId) {
    await dashboardApiRequest(
      `/dashboard/finance/package-purchases/${purchaseId}/refund`,
      token,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundAmount: 0 }),
      }
    ).catch(() => undefined)
  }
  if (packageId)
    await dashboardApiRequest(
      `/dashboard/organization/packages/${packageId}`,
      token,
      {
        method: "DELETE",
      }
    ).catch(() => undefined)
  if (employee?.id)
    await cleanupEmployee(employee.id, token).catch(() => undefined)
  if (service?.id)
    await cleanupService(service.id, token).catch(() => undefined)
  if (categoryId)
    await dashboardApiRequest(
      `/dashboard/organization/categories/${categoryId}`,
      token,
      { method: "DELETE" }
    ).catch(() => undefined)
  for (const client of [normalClient, packageClient, groupClient]) {
    if (client?.id) await cleanupClient(client.id, token).catch(() => undefined)
  }
})

test("distinguishes unpaid, package-funded, and group bookings and shows the package name in details", async ({
  page,
}) => {
  await loginAs(page, "admin")
  await openBookings(page)

  const normalRow = await searchBookingRow(page, clientName(normalClient))
  await expect(
    normalRow.getByRole("button", { name: /تسجيل دفعة|record payment/i })
  ).toBeVisible()

  const packageRow = await searchBookingRow(page, clientName(packageClient))
  await expect(
    packageRow.getByText(/مخصوم من باقة|covered by package/i)
  ).toBeVisible()
  await expect(
    packageRow.getByRole("button", { name: /تسجيل دفعة|record payment/i })
  ).toHaveCount(0)

  const groupRow = await searchBookingRow(page, clientName(groupClient))
  await expect(groupRow.locator('[data-booking-type="group"]')).toBeVisible()

  const packageRowForDetails = await searchBookingRow(
    page,
    clientName(packageClient)
  )
  await packageRowForDetails
    .getByRole("button", {
      name: new RegExp(escapeRegex(clientName(packageClient))),
    })
    .first()
    .click()
  const details = page
    .getByRole("dialog")
    .filter({ hasText: clientName(packageClient) })
    .first()
  await expect(details).toBeVisible()
  const packageLink = details.getByRole("link", { name: packageNameAr })
  await expect(packageLink).toBeVisible()
  await expect(packageLink).toHaveAttribute("href", `/packages/${packageId}`)

  await cleanupBooking(packageBooking.id, token)
  await openBookings(page)
  const returnedPackageRow = await searchBookingRow(
    page,
    clientName(packageClient)
  )
  await expect(
    returnedPackageRow.getByText(
      /أُعيد الرصيد إلى الباقة|Credit returned to package/i
    )
  ).toBeVisible()
})

async function openBookings(page: Page) {
  await page.goto("/bookings", { waitUntil: "domcontentloaded" })
  await expectCurrentPath(page, "/bookings")
  await expectNoAppCrash(page)
  await expect(
    page.getByRole("heading", { name: /الحجوزات|Bookings/i })
  ).toBeVisible()

  const allTab = page
    .getByRole("tab", { name: /^الكل$|^All$/ })
    .or(page.getByRole("button", { name: /^الكل$|^All$/ }))
    .first()
  await expect(allTab).toBeVisible({ timeout: 10_000 })
  await allTab.click()
}

async function searchBookingRow(page: Page, name: string) {
  const search = page.getByPlaceholder(/بحث|Search/i).first()
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill("")
  await search.fill(name)
  const row = page.getByRole("row").filter({ hasText: name }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  return row
}

function clientName(client: SeededClient) {
  return `${client.firstName} ${client.lastName}`
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function postJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  return requestJson<T>(path, "POST", body)
}

async function putJson<T>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  return requestJson<T>(path, "PUT", body)
}

async function patchJson<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  return requestJson<T>(path, "PATCH", body)
}

async function requestJson<T>(
  path: string,
  method: "POST" | "PUT" | "PATCH",
  body: Record<string, unknown>
): Promise<T> {
  const response = await dashboardApiRequest(path, token, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "(unreadable)")
    throw new Error(
      `[booking-package-funding] ${method} ${path} failed — HTTP ${response.status}: ${text}`
    )
  }
  return response.json() as Promise<T>
}
