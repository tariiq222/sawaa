/**
 * RBAC route and API authorization coverage for seeded dashboard personas.
 *
 * This spec documents the current single-tenant contract:
 * - admin can read the critical operations/finance/admin routes.
 * - receptionist can read bookings and invoices, but cannot read payments,
 *   reports, or users.
 * - employee can read bookings only among these critical dashboard routes.
 * - ACCOUNTANT is intentionally absent from this matrix because the current
 *   e2e seed does not create an accountant persona; finance-role coverage is
 *   still important and should be added when that persona is seeded.
 */
import { expect, test, type Page } from "@playwright/test"
import { expectCurrentPath, expectNoAppCrash } from "../../fixtures/assertions"
import { loginAs, type Persona } from "../../fixtures/auth"
import { getTestTenant } from "../../fixtures/tenant"
import {
  cleanupBooking,
  cleanupBranch,
  cleanupClient,
  cleanupEmployee,
  cleanupService,
  createInvoice,
  dashboardApiRequest,
  ensureValidBranchId,
  getPersonaToken,
  seedBooking,
  seedClient,
  seedEmployee,
  seedService,
  type SeededBooking,
  type SeededClient,
  type SeededEmployee,
  type SeededInvoice,
  type SeededService,
} from "../../fixtures/seed"

type RouteExpectation = {
  path: "/bookings" | "/payments" | "/invoices" | "/reports" | "/users"
  heading: RegExp
  expected: "allowed" | "no-permission"
  reason: string
}

type ApiExpectation = {
  label: string
  path: (invoiceId: string) => string
  expectedStatus: number
  reason: string
}

const NO_PERMISSION =
  /ليس لديك صلاحية للوصول لهذه الصفحة|You don't have permission to access this page/i

const ROUTE_EXPECTATIONS: Record<
  "admin" | "receptionist" | "employee",
  RouteExpectation[]
> = {
  admin: [
    {
      path: "/bookings",
      heading: /الحجوزات|Bookings/i,
      expected: "allowed",
      reason: "ADMIN has booking:*",
    },
    {
      path: "/payments",
      heading: /المدفوعات|Payments/i,
      expected: "allowed",
      reason: "ADMIN has payment:*",
    },
    {
      path: "/invoices",
      heading: /الفواتير|Invoices/i,
      expected: "allowed",
      reason: "ADMIN has invoice:*",
    },
    {
      path: "/reports",
      heading: /التقارير|Reports/i,
      expected: "allowed",
      reason: "ADMIN has report:*",
    },
    {
      path: "/users",
      heading: /المستخدمون والأدوار|Users & Roles/i,
      expected: "allowed",
      reason: "ADMIN has user:*",
    },
  ],
  receptionist: [
    {
      path: "/bookings",
      heading: /الحجوزات|Bookings/i,
      expected: "allowed",
      reason: "RECEPTIONIST has booking:read",
    },
    {
      path: "/payments",
      heading: /المدفوعات|Payments/i,
      expected: "no-permission",
      reason: "RECEPTIONIST has no payment:read",
    },
    {
      path: "/invoices",
      heading: /الفواتير|Invoices/i,
      expected: "allowed",
      reason: "RECEPTIONIST has invoice:read",
    },
    {
      path: "/reports",
      heading: /التقارير|Reports/i,
      expected: "no-permission",
      reason: "RECEPTIONIST has no report:read",
    },
    {
      path: "/users",
      heading: /المستخدمون والأدوار|Users & Roles/i,
      expected: "no-permission",
      reason: "RECEPTIONIST has no user:read",
    },
  ],
  employee: [
    {
      path: "/bookings",
      heading: /الحجوزات|Bookings/i,
      expected: "allowed",
      reason: "EMPLOYEE has booking:read",
    },
    {
      path: "/payments",
      heading: /المدفوعات|Payments/i,
      expected: "no-permission",
      reason: "EMPLOYEE has no payment:read",
    },
    {
      path: "/invoices",
      heading: /الفواتير|Invoices/i,
      expected: "no-permission",
      reason: "EMPLOYEE has no invoice:read",
    },
    {
      path: "/reports",
      heading: /التقارير|Reports/i,
      expected: "no-permission",
      reason: "EMPLOYEE has no report:read",
    },
    {
      path: "/users",
      heading: /المستخدمون والأدوار|Users & Roles/i,
      expected: "no-permission",
      reason: "EMPLOYEE has no user:read",
    },
  ],
}

const API_EXPECTATIONS: Record<
  "admin" | "receptionist" | "employee",
  ApiExpectation[]
> = {
  admin: [
    {
      label: "bookings read",
      path: () => "/dashboard/bookings?limit=1",
      expectedStatus: 200,
      reason: "ADMIN has booking:read via manage",
    },
    {
      label: "payments read",
      path: () => "/dashboard/finance/payments?limit=1",
      expectedStatus: 200,
      reason: "ADMIN has payment:read via manage",
    },
    {
      label: "invoice direct read",
      path: (invoiceId) => `/dashboard/finance/invoices/${invoiceId}`,
      expectedStatus: 200,
      reason: "ADMIN has invoice:read via manage",
    },
  ],
  receptionist: [
    {
      label: "bookings read",
      path: () => "/dashboard/bookings?limit=1",
      expectedStatus: 200,
      reason: "RECEPTIONIST has booking:read",
    },
    {
      label: "payments read",
      path: () => "/dashboard/finance/payments?limit=1",
      expectedStatus: 403,
      reason: "RECEPTIONIST has no payment:read",
    },
    {
      label: "invoice direct read",
      path: (invoiceId) => `/dashboard/finance/invoices/${invoiceId}`,
      expectedStatus: 200,
      reason: "RECEPTIONIST has invoice:read",
    },
  ],
  employee: [
    {
      label: "bookings read",
      path: () => "/dashboard/bookings?limit=1",
      expectedStatus: 200,
      reason: "EMPLOYEE has booking:read",
    },
    {
      label: "payments read",
      path: () => "/dashboard/finance/payments?limit=1",
      expectedStatus: 403,
      reason: "EMPLOYEE has no payment:read",
    },
    {
      label: "invoice direct read",
      path: (invoiceId) => `/dashboard/finance/invoices/${invoiceId}`,
      expectedStatus: 403,
      reason: "EMPLOYEE has no invoice:read",
    },
  ],
}

let adminToken = ""
let seededClient: SeededClient
let seededService: SeededService
let seededEmployee: SeededEmployee
let seededBooking: SeededBooking
let seededInvoice: SeededInvoice
let seededBranchId = ""

test.beforeAll(async () => {
  const tenant = await getTestTenant()
  adminToken = tenant.accessToken

  seededClient = await seedClient(adminToken, {
    firstName: "اختبار",
    lastName: `صلاحيات ${Date.now().toString().slice(-5)}`,
    gender: "FEMALE",
  })
  seededService = await seedService(adminToken, {
    nameAr: "خدمة صلاحيات",
    nameEn: "RBAC Service",
    durationMins: 30,
    price: 20_000,
  })
  seededEmployee = await seedEmployee(adminToken, {
    name: "موظف صلاحيات",
    gender: "MALE",
  })
  seededBranchId = await ensureValidBranchId(adminToken)
  seededBooking = await seedBooking(adminToken, {
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    serviceId: seededService.id,
    payAtClinic: true,
  })
  seededInvoice = await createInvoice(adminToken, {
    bookingId: seededBooking.id,
    branchId: seededBranchId,
    clientId: seededClient.id,
    employeeId: seededEmployee.id,
    subtotal: 20_000,
    vatRate: 0.15,
    notes: `rbac api invoice ${seededBooking.id}`,
  })
})

test.afterAll(async () => {
  // Dashboard finance exposes create/get/list for invoices/payments but no
  // DELETE endpoint. Seeded invoice/payment rows are audit records and are not
  // claimed as cleaned up here.
  if (seededBooking?.id)
    await cleanupBooking(seededBooking.id, adminToken).catch(() => undefined)
  if (seededEmployee?.id)
    await cleanupEmployee(seededEmployee.id, adminToken).catch(() => undefined)
  if (seededService?.id)
    await cleanupService(seededService.id, adminToken).catch(() => undefined)
  if (seededClient?.id)
    await cleanupClient(seededClient.id, adminToken).catch(() => undefined)
  if (seededBranchId) await cleanupBranch(seededBranchId, adminToken)
})

test.describe("RBAC direct route access", () => {
  for (const [persona, routes] of Object.entries(ROUTE_EXPECTATIONS) as Array<
    ["admin" | "receptionist" | "employee", RouteExpectation[]]
  >) {
    test.describe(`${persona} persona`, () => {
      for (const route of routes) {
        test(`${persona} ${route.expected} ${route.path} — ${route.reason}`, async ({
          page,
        }) => {
          await loginAs(page, persona)
          await assertRouteAccess(page, route)
          if (persona === "receptionist" && route.path === "/invoices") {
            await assertReceptionistInvoicesBackendMismatch()
          }
        })
      }
    })
  }
})

test.describe("RBAC API authorization matrix", () => {
  for (const [persona, requests] of Object.entries(API_EXPECTATIONS) as Array<
    ["admin" | "receptionist" | "employee", ApiExpectation[]]
  >) {
    test(`${persona} API permissions match the documented CASL contract`, async () => {
      const token = await getPersonaToken(persona as Persona)

      for (const request of requests) {
        const response = await dashboardApiRequest(
          request.path(seededInvoice.id),
          token,
          { method: "GET" }
        )
        expect(
          response.status,
          `${persona} ${request.label}: ${request.reason}`
        ).toBe(request.expectedStatus)
      }
    })
  }
})

async function assertRouteAccess(page: Page, route: RouteExpectation) {
  await page.goto(route.path, { waitUntil: "domcontentloaded" })
  await expectCurrentPath(page, route.path)
  await expectNoAppCrash(page)

  if (route.expected === "allowed") {
    await expect(
      page.getByRole("heading", { name: route.heading }).first(),
      route.reason
    ).toBeVisible()
    await expect(page.getByText(NO_PERMISSION)).toHaveCount(0)
    return
  }

  await expect(page.getByText(NO_PERMISSION), route.reason).toBeVisible()
  await expect(page.getByRole("heading", { name: route.heading })).toHaveCount(
    0
  )
}

async function assertReceptionistInvoicesBackendMismatch() {
  const token = await getPersonaToken("receptionist")
  const response = await dashboardApiRequest(
    "/dashboard/finance/payments?limit=1",
    token,
    { method: "GET" }
  )

  expect(
    response.status,
    "Current /invoices UI renders a heading for invoice:read, but the page data source still calls payments and is forbidden for receptionist."
  ).toBe(403)
}
