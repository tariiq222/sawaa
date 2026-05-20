/**
 * e2e/fixtures/seed.ts
 *
 * Typed API helpers for creating and cleaning up test data in e2e tests.
 *
 * All helpers POST / DELETE to the live backend running on :5200 using a
 * JWT obtained from getTestTenant(). They operate inside the seeded
 * default org (DEFAULT_ORG_ID) and are safe to call in beforeEach/afterEach.
 *
 * Usage:
 *   import { seedClient, seedService, seedEmployee, seedBooking } from '../fixtures/seed';
 *   import { getTestTenant } from '../fixtures/tenant';
 *
 *   let token: string;
 *   test.beforeAll(async () => { token = (await getTestTenant()).accessToken; });
 *
 *   test.beforeEach(async () => {
 *     const client = await seedClient(token);
 *     const service = await seedService(token);
 *   });
 */
import { getPersonaCredentials, type Persona } from "./auth"

// ─── Backend base URL ─────────────────────────────────────────────────────

const API_BASE = process.env.PW_API_URL ?? "http://localhost:5200"

export type PaymentMethod = "ONLINE_CARD" | "BANK_TRANSFER" | "CASH" | "COUPON"

export interface DashboardLoginResponse {
  accessToken: string
}

export interface CreateInvoiceInput {
  bookingId: string
  branchId: string
  clientId: string
  employeeId: string
  subtotal: number
  discountAmt?: number
  vatRate?: number
  notes?: string
  dueAt?: string
}

export interface SeededInvoice {
  id: string
  number?: number
  bookingId: string
  clientId: string
  employeeId: string
  branchId: string
  subtotal: number | string
  discountAmt?: number | string
  vatAmt: number | string
  total: number | string
  status: string
}

export interface CreatePaymentInput {
  invoiceId: string
  amount: number
  method?: PaymentMethod
  gatewayRef?: string
  idempotencyKey?: string
}

export interface SeededPayment {
  id: string
  number?: number
  invoiceId: string
  amount: number | string
  method: PaymentMethod | string
  status: string
}

export interface RefundPaymentInput {
  reason: string
  amount?: number
}

// ─── Input types (mirrors backend DTOs — only required + common optionals) ─

export interface SeedClientInput {
  firstName?: string
  lastName?: string
  /** Must match Saudi E.164: +9665XXXXXXXX */
  phone?: string
  gender?: "MALE" | "FEMALE"
}

export interface SeedServiceInput {
  nameAr?: string
  nameEn?: string
  durationMins?: number
  price?: number
  currency?: string
}

export interface SeedEmployeeInput {
  name?: string
  email?: string
  phone?: string
  gender?: "MALE" | "FEMALE"
}

export interface SeedBookingInput {
  clientId: string
  employeeId: string
  serviceId: string
  /** ISO 8601 datetime — defaults to tomorrow 09:00 Asia/Riyadh */
  scheduledAt?: string
  branchId?: string
  payAtClinic?: boolean
}

// ─── Seeded entity shapes ────────────────────────────────────────────────

export interface SeededClient {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export interface SeededService {
  id: string
  nameAr: string
  nameEn: string
  durationMins: number
  price: number
}

export interface SeededEmployee {
  id: string
  name: string
  email: string | null
}

export interface SeededBooking {
  id: string
  clientId: string
  employeeId: string
  serviceId: string
  scheduledAt: string
  status: string
}

// ─── Counter for unique phone numbers within a test run ──────────────────

let phoneCounter = 0

function uniquePhone(): string {
  // Format: +9665XXXXXXXX — 5 chars prefix + 8 digits = 13 total (E.164)
  const suffix =
    String(Date.now()).slice(-6) + String(phoneCounter++).padStart(2, "0")
  return `+9665${suffix.slice(0, 8)}`
}

function uniqueSuffix(): string {
  return String(Date.now()).slice(-6) + String(phoneCounter++).padStart(2, "0")
}

// ─── Internal fetch helpers ────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 4,
  delayMs = 600
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
  // Last response was 429 — return it so caller can throw
  return fetch(url, init)
}

async function apiPost<T>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[seed] POST ${path} failed — HTTP ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[seed] GET ${path} failed — HTTP ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export async function dashboardApiRequest(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  return fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers,
  })
}

export async function getPersonaToken(persona: Persona): Promise<string> {
  const { email, password } = getPersonaCredentials(persona)
  const res = await fetchWithRetry(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(
      `[seed] Login failed for persona ${persona} (${email}) — HTTP ${res.status}: ${text}`
    )
  }

  const data = (await res.json()) as DashboardLoginResponse
  if (!data.accessToken) {
    throw new Error(
      `[seed] Login response missing accessToken for persona ${persona}`
    )
  }
  return data.accessToken
}

async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })

  // 404 on cleanup is fine — the record may have already been removed.
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(
      `[seed] DELETE ${path} failed — HTTP ${res.status}: ${text}`
    )
  }
}

async function apiPatch<T>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[seed] PATCH ${path} failed — HTTP ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── Client ──────────────────────────────────────────────────────────────

/**
 * Create a test client via POST /dashboard/people/clients.
 * Cleans up with cleanupClient(id, token).
 */
export async function seedClient(
  token: string,
  overrides: SeedClientInput = {}
): Promise<SeededClient> {
  const body = {
    firstName: overrides.firstName ?? "اختبار",
    lastName: overrides.lastName ?? "عميل",
    phone: overrides.phone ?? uniquePhone(),
    gender: overrides.gender ?? "FEMALE",
  }

  const created = await apiPost<{
    id: string
    firstName: string
    lastName: string
    phone: string
  }>("/dashboard/people/clients", token, body)

  return {
    id: created.id,
    firstName: created.firstName,
    lastName: created.lastName,
    phone: created.phone,
  }
}

export async function cleanupClient(id: string, token: string): Promise<void> {
  await apiDelete(`/dashboard/people/clients/${id}`, token)
}

// ─── Service ─────────────────────────────────────────────────────────────

/**
 * Create a test service via POST /dashboard/organization/services.
 * Cleans up with cleanupService(id, token).
 */
export async function seedService(
  token: string,
  overrides: SeedServiceInput = {}
): Promise<SeededService> {
  const suffix = uniqueSuffix()
  const baseNameAr = overrides.nameAr ?? "خدمة اختبار"
  const baseNameEn = overrides.nameEn ?? "Test Service"
  const body = {
    nameAr: `${baseNameAr} ${suffix}`,
    nameEn: `${baseNameEn} ${suffix}`,
    durationMins: overrides.durationMins ?? 30,
    price: overrides.price ?? 100,
    currency: overrides.currency ?? "SAR",
    isActive: true,
  }

  const created = await apiPost<{
    id: string
    nameAr: string
    nameEn: string
    durationMins: number
    price: number
  }>("/dashboard/organization/services", token, body)

  return {
    id: created.id,
    nameAr: created.nameAr,
    nameEn: created.nameEn ?? body.nameEn,
    durationMins: created.durationMins,
    price: created.price,
  }
}

export async function cleanupService(id: string, token: string): Promise<void> {
  // Services use archive (soft delete) endpoint
  await apiDelete(`/dashboard/organization/services/${id}`, token)
}

// ─── Employee ↔ Service assignment ────────────────────────────────────────

/**
 * Assign an employee to a service so bookings can be created.
 */
export async function assignEmployeeToService(
  token: string,
  employeeId: string,
  serviceId: string
): Promise<void> {
  await apiPost(`/dashboard/people/employees/${employeeId}/services`, token, {
    serviceId,
  })
}

// ─── Branch ─────────────────────────────────────────────────────────────────

/**
 * Create a branch with a valid RFC 4122 UUID and return its ID.
 * The seeded DEFAULT_BRANCH_ID uses an invalid variant and is rejected
 * by the backend's @IsUUID validation, so we always create a fresh branch.
 */
export async function ensureValidBranchId(token: string): Promise<string> {
  // Always create a fresh branch to avoid stale cache issues.
  // Create a branch with a valid RFC 4122 UUID (the seeded DEFAULT_BRANCH_ID
  // uses an invalid variant and is rejected by @IsUUID validation).
  const suffix = uniqueSuffix()
  const created = await apiPost<{ id: string }>(
    "/dashboard/organization/branches",
    token,
    {
      nameAr: `فرع اختبار ${suffix}`,
      nameEn: `Test Branch ${suffix}`,
      isMain: false,
    }
  )

  // Enable pay-at-clinic so bookings with payAtClinic: true succeed
  await apiPatch(
    `/dashboard/organization/booking-settings?branchId=${created.id}`,
    token,
    {
      payAtClinicEnabled: true,
    }
  ).catch(() => {
    // Ignore errors — settings endpoint may not exist or may require different payload
  })

  return created.id
}

export async function cleanupBranch(
  branchId: string,
  token: string
): Promise<void> {
  // Branch has a real DELETE endpoint. Only 404 is tolerated by apiDelete;
  // any FK/conflict/authorization failure must surface to the caller.
  await apiDelete(`/dashboard/organization/branches/${branchId}`, token)
}

// ─── Employee ─────────────────────────────────────────────────────────────

/**
 * Create a test employee via POST /dashboard/people/employees.
 * Cleans up with cleanupEmployee(id, token).
 */
export async function seedEmployee(
  token: string,
  overrides: SeedEmployeeInput = {}
): Promise<SeededEmployee> {
  // Generate a unique email if none provided to avoid unique-constraint collisions
  const suffix = uniqueSuffix()
  const email = overrides.email ?? `e2e-employee-${suffix}@sawaa-test.com`

  const body = {
    name: overrides.name ?? `موظف اختبار ${suffix}`,
    email,
    phone: overrides.phone,
    gender: overrides.gender ?? "MALE",
  }

  const created = await apiPost<{
    id: string
    name: string
    email: string | null
  }>("/dashboard/people/employees", token, body)

  return {
    id: created.id,
    name: created.name,
    email: created.email,
  }
}

export async function cleanupEmployee(
  id: string,
  token: string
): Promise<void> {
  await apiDelete(`/dashboard/people/employees/${id}`, token)
}

// ─── Booking ──────────────────────────────────────────────────────────────

/**
 * Create a test booking via POST /dashboard/bookings.
 * Cleans up with cleanupBooking(id, token).
 *
 * Requires a pre-existing client, employee, and service — create them
 * first with seedClient / seedEmployee / seedService.
 *
 * Note: automatically assigns the employee to the service and resolves
 * a valid branch UUID (the seeded DEFAULT_BRANCH_ID uses an invalid
 * RFC 4122 variant and is rejected by @IsUUID validation).
 */
export async function seedBooking(
  token: string,
  input: SeedBookingInput
): Promise<SeededBooking> {
  // Default scheduledAt: tomorrow at 09:00 Asia/Riyadh (UTC+3 = 06:00Z)
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  tomorrow.setUTCHours(6, 0, 0, 0) // 06:00 UTC = 09:00 Riyadh

  // Ensure employee is assigned to the service
  await assignEmployeeToService(token, input.employeeId, input.serviceId).catch(
    () => {
      // 409 Conflict = already assigned; ignore
    }
  )

  // Resolve a valid branch UUID
  const branchId = input.branchId ?? (await ensureValidBranchId(token))

  const body = {
    branchId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt: input.scheduledAt ?? tomorrow.toISOString(),
    payAtClinic: input.payAtClinic ?? false,
    bookingType: "INDIVIDUAL",
  }

  const created = await apiPost<{
    id: string
    clientId: string
    employeeId: string
    serviceId: string
    scheduledAt: string
    status: string
  }>("/dashboard/bookings", token, body)

  return {
    id: created.id,
    clientId: created.clientId,
    employeeId: created.employeeId,
    serviceId: created.serviceId,
    scheduledAt: created.scheduledAt,
    status: created.status,
  }
}

export async function cleanupBooking(id: string, token: string): Promise<void> {
  // Cancel then the nightly cleanup will purge it; DELETE is not exposed
  const res = await fetch(
    `${API_BASE}/api/v1/dashboard/bookings/${id}/cancel`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: "e2e test cleanup" }),
    }
  )

  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(
      `[seed] PATCH /bookings/${id}/cancel failed — HTTP ${res.status}: ${text}`
    )
  }
}

// ─── Finance ──────────────────────────────────────────────────────────────

export async function createInvoice(
  token: string,
  input: CreateInvoiceInput
): Promise<SeededInvoice> {
  return apiPost<SeededInvoice>("/dashboard/finance/invoices", token, input)
}

export async function getInvoice(
  token: string,
  invoiceId: string
): Promise<SeededInvoice> {
  return apiGet<SeededInvoice>(
    `/dashboard/finance/invoices/${invoiceId}`,
    token
  )
}

export async function createPayment(
  token: string,
  input: CreatePaymentInput
): Promise<SeededPayment> {
  const suffix = uniqueSuffix()
  return apiPost<SeededPayment>("/dashboard/finance/payments", token, {
    invoiceId: input.invoiceId,
    amount: input.amount,
    method: input.method ?? "CASH",
    gatewayRef: input.gatewayRef ?? `e2e-payment-${suffix}`,
    idempotencyKey: input.idempotencyKey ?? `e2e-payment-${suffix}`,
  })
}

export async function refundPayment(
  token: string,
  paymentId: string,
  input: RefundPaymentInput
): Promise<SeededPayment> {
  return apiPatch<SeededPayment>(
    `/dashboard/finance/payments/${paymentId}/refund`,
    token,
    input
  )
}
