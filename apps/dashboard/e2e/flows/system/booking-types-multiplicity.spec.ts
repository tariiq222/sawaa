/**
 * Booking type and multiplicity coverage.
 *
 * The dashboard POS covers the main individual booking flow. This spec covers
 * the remaining dashboard booking contracts and verifies they surface in the
 * bookings list: individual, walk-in, and group.
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
  createDashboardBooking,
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
  type SeededService,
} from "../../fixtures/seed"

let token = ""
let branchId = ""
let client: SeededClient
let individualService: SeededService
let walkInService: SeededService
let groupService: SeededService
let employee: SeededEmployee
let bookings: SeededBooking[] = []
let individualBooking: SeededBooking
let walkInBooking: SeededBooking
let groupBooking: SeededBooking

test.beforeAll(async () => {
  const organization = await getTestTenant()
  token = organization.accessToken

  client = await seedClient(token, {
    firstName: "تعدد",
    lastName: `حجوزات ${Date.now().toString().slice(-5)}`,
    gender: "MALE",
  })

  employee = await seedEmployee(token, {
    name: `ممارس تعدد ${Date.now().toString().slice(-5)}`,
    gender: "MALE",
  })

  branchId = await ensureValidMainBranchId(token)
  await prepareBookableSchedule(token, { branchId, employeeId: employee.id })

  individualService = await createBookableService("حجز فردي تعدد")
  walkInService = await createBookableService("حجز حضور مباشر تعدد")
  groupService = await createBookableService("حجز جماعي تعدد", {
    minParticipants: 2,
    maxParticipants: 5,
    reserveWithoutPayment: true,
  })

  individualBooking = await createDashboardBooking(token, {
    branchId,
    clientId: client.id,
    employeeId: employee.id,
    serviceId: individualService.id,
    scheduledAt: slotIso(2, 9),
    bookingType: "INDIVIDUAL",
    deliveryType: "IN_PERSON",
    payAtClinic: true,
    notes: "e2e individual booking type",
  })

  walkInBooking = await createDashboardBooking(token, {
    branchId,
    clientId: client.id,
    employeeId: employee.id,
    serviceId: walkInService.id,
    scheduledAt: slotIso(2, 10),
    bookingType: "WALK_IN",
    deliveryType: "IN_PERSON",
    payAtClinic: true,
    notes: "e2e walk-in booking type",
  })

  groupBooking = await createDashboardBooking(token, {
    branchId,
    clientId: client.id,
    employeeId: employee.id,
    serviceId: groupService.id,
    scheduledAt: slotIso(2, 11),
    bookingType: "GROUP",
    deliveryType: "IN_PERSON",
    payAtClinic: true,
    notes: "e2e group booking type",
  })

  bookings = [
    individualBooking,
    walkInBooking,
    groupBooking,
  ]
})

test.afterAll(async () => {
  for (const booking of bookings) {
    await cleanupBooking(booking.id, token).catch(() => undefined)
  }
  if (employee?.id) await cleanupEmployee(employee.id, token).catch(() => undefined)
  for (const service of [
    individualService,
    walkInService,
    groupService,
  ]) {
    if (service?.id) await cleanupService(service.id, token).catch(() => undefined)
  }
  if (client?.id) await cleanupClient(client.id, token).catch(() => undefined)
  if (branchId) await cleanupBranch(branchId, token).catch(() => undefined)
})

test.describe("Booking types and multiplicity", () => {
  test("surfaces individual, walk-in, and group booking types", async ({
    page,
  }) => {
    await loginAs(page, "admin")
    await page.goto("/bookings")
    await expectCurrentPath(page, "/bookings")
    await expectNoAppCrash(page)

    await expectBookingContract(individualBooking, {
      serviceId: individualService.id,
      type: "in_person",
    })
    await expectBookingContract(walkInBooking, {
      serviceId: walkInService.id,
      type: "walk_in",
    })
    await expectBookingContract(groupBooking, {
      serviceId: groupService.id,
      type: "group",
    })

    await expectSeededBookingRow(page, individualBooking, /زيارة حضورية|In-person/i)
    await expectSeededBookingRow(page, walkInBooking, /زيارة مباشرة|Walk-in/i)
    await expectSeededBookingRow(page, groupBooking, /group|جماعي/i)
  })
})

async function createBookableService(
  nameAr: string,
  overrides: Partial<Parameters<typeof seedService>[1]> = {}
) {
  const service = await seedService(token, {
    nameAr,
    nameEn: nameAr,
    durationMins: 30,
    price: 12_000,
    ...overrides,
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
  return service
}

async function expectSeededBookingRow(
  page: Page,
  booking: SeededBooking,
  typeLabel: RegExp
) {
  await page
    .getByRole("textbox", { name: /بحث بالاسم|Search by name/i })
    .fill(booking.id)
  const row = page.getByRole("row").filter({ hasText: clientFullName() }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect(row.getByText(typeLabel).first()).toBeVisible()
}

async function expectBookingContract(
  booking: SeededBooking,
  expected: { serviceId: string; type: "in_person" | "walk_in" | "group" }
) {
  const detail = await getDashboardBooking(booking.id)
  expect(detail.id).toBe(booking.id)
  expect(detail.clientId).toBe(client.id)
  expect(detail.employeeId).toBe(employee.id)
  expect(detail.serviceId).toBe(expected.serviceId)
  expect(detail.type).toBe(expected.type)

  const filtered = await listDashboardBookings({
    serviceId: expected.serviceId,
    bookingType: expected.type,
  })
  expect(filtered.items.map((item) => item.id)).toContain(booking.id)
}

async function getDashboardBooking(id: string): Promise<DashboardBookingRow> {
  const response = await dashboardApiRequest(`/dashboard/bookings/${id}`, token)
  if (!response.ok) {
    throw new Error(`GET /dashboard/bookings/${id} failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<DashboardBookingRow>
}

async function listDashboardBookings(filters: {
  serviceId: string
  bookingType: "in_person" | "walk_in" | "group"
}): Promise<DashboardBookingListResponse> {
  const params = new URLSearchParams({
    serviceId: filters.serviceId,
    bookingType: filters.bookingType,
    limit: "10",
  })
  const response = await dashboardApiRequest(`/dashboard/bookings?${params.toString()}`, token)
  if (!response.ok) {
    throw new Error(`GET /dashboard/bookings?${params.toString()} failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<DashboardBookingListResponse>
}

function slotIso(dayOffset: number, hourRiyadh: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + dayOffset)
  date.setUTCHours(hourRiyadh - 3, 0, 0, 0)
  return date.toISOString()
}

function clientFullName() {
  return `${client.firstName} ${client.lastName}`
}

interface DashboardBookingRow {
  id: string
  clientId: string
  employeeId: string
  serviceId: string
  type: "in_person" | "walk_in" | "group"
}

interface DashboardBookingListResponse {
  items: DashboardBookingRow[]
  meta: { total: number }
}
