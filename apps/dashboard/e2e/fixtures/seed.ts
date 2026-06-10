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
  allowRecurring?: boolean
  allowedRecurringPatterns?: string[]
  maxRecurrences?: number
  minParticipants?: number
  maxParticipants?: number
  reserveWithoutPayment?: boolean
  /** Skip auto-creating the default IN_PERSON booking config (default false). */
  skipBookingConfig?: boolean
  /** Attach the service to this category instead of the auto-created one. */
  categoryId?: string
  /** Skip attaching any category (default false). */
  skipCategory?: boolean
}

export interface SeedEmployeeInput {
  name?: string
  email?: string
  phone?: string
  gender?: "MALE" | "FEMALE"
  /** Skip the default 7-day availability window seeded for wizard visibility. */
  skipAvailability?: boolean
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

export interface CreateDashboardBookingInput {
  branchId: string
  clientId: string
  employeeId: string
  serviceId: string
  scheduledAt: string
  bookingType?: "INDIVIDUAL" | "WALK_IN" | "GROUP"
  deliveryType?: "IN_PERSON" | "ONLINE"
  payAtClinic?: boolean
  notes?: string
}

export interface CreateRecurringDashboardBookingInput {
  branchId: string
  clientId: string
  employeeId: string
  serviceId: string
  scheduledAt: string
  durationMins: number
  price: number
  frequency: "DAILY" | "WEEKLY" | "CUSTOM"
  occurrences?: number
  intervalDays?: number
  bookingType?: "INDIVIDUAL" | "WALK_IN" | "GROUP"
  deliveryType?: "IN_PERSON" | "ONLINE"
  notes?: string
  skipConflicts?: boolean
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

export interface ServiceBookingTypeInput {
  deliveryType?: "IN_PERSON" | "ONLINE"
  durationMins: number
  price: number
  isActive?: boolean
  useCustomAvailability?: boolean
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

async function apiPut<T>(
  path: string,
  token: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(`${API_BASE}/api/v1${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)")
    throw new Error(`[seed] PUT ${path} failed — HTTP ${res.status}: ${text}`)
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

// One shared category per run is enough to make seeded services appear in the
// booking wizard's clinic/service step. Cached so we don't create one per
// service. (Categories are lightweight and left for the suite to clean up.)
let cachedTestCategoryId: string | null = null

async function ensureTestCategoryId(token: string): Promise<string | undefined> {
  if (cachedTestCategoryId) return cachedTestCategoryId
  try {
    // Attach the category to a real department so the booking wizard chain
    // (department → category → service) can reach the seeded service. Prefer the
    // individual-clinic department ("عيادات"/Clinics); fall back to the first.
    // The list endpoint returns { items, meta } (not { data }).
    const deps = await apiGet<{
      items?: Array<{ id: string; nameAr?: string; nameEn?: string }>
    }>("/dashboard/organization/departments?isActive=true", token)
      .then((r) => r.items ?? [])
      .catch(() => [] as Array<{ id: string; nameAr?: string; nameEn?: string }>)
    const clinic =
      deps.find(
        (d) => d.nameAr === "عيادات" || /clinic/i.test(d.nameEn ?? "")
      ) ?? deps[0]

    const created = await apiPost<{ id: string }>(
      "/dashboard/organization/categories",
      token,
      {
        nameAr: "فئة اختبار",
        nameEn: "Test Category",
        ...(clinic ? { departmentId: clinic.id } : {}),
      }
    )
    cachedTestCategoryId = created.id
    return created.id
  } catch {
    // Best-effort: if category creation fails, fall back to no category.
    return undefined
  }
}

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
  // The booking wizard's service step is gated on a category (clinic): it only
  // fetches services for a selected categoryId (`enabled: !!categoryId`). A
  // service with no category never appears in the wizard, so wizard-driven
  // tests can't select it. Attach a category by default (auto-create one).
  const categoryId =
    overrides.categoryId ??
    (overrides.skipCategory === true
      ? undefined
      : await ensureTestCategoryId(token))

  const body = {
    nameAr: `${baseNameAr} ${suffix}`,
    nameEn: `${baseNameEn} ${suffix}`,
    durationMins: overrides.durationMins ?? 30,
    price: overrides.price ?? 100,
    currency: overrides.currency ?? "SAR",
    isActive: true,
    categoryId,
    allowRecurring: overrides.allowRecurring,
    allowedRecurringPatterns: overrides.allowedRecurringPatterns,
    maxRecurrences: overrides.maxRecurrences,
    minParticipants: overrides.minParticipants,
    maxParticipants: overrides.maxParticipants,
    reserveWithoutPayment: overrides.reserveWithoutPayment,
  }

  const created = await apiPost<{
    id: string
    nameAr: string
    nameEn: string
    durationMins: number
    price: number
  }>("/dashboard/organization/services", token, body)

  // The availability engine returns zero slots for a service that has no
  // ServiceBookingConfig for the requested deliveryType (gate in
  // check-availability.handler: `if (serviceId && !serviceConfig) return []`).
  // Without this, seeded bookings fail with "Selected booking time is not
  // available". Give every seeded service an active IN_PERSON config using
  // branch hours (useCustomAvailability: false) so it is bookable. Callers can
  // still override the configs explicitly via setServiceBookingTypes.
  if (overrides.skipBookingConfig !== true) {
    await setServiceBookingTypes(token, created.id, [
      {
        deliveryType: "IN_PERSON",
        durationMins: created.durationMins,
        price: created.price,
        isActive: true,
        useCustomAvailability: false,
      },
    ]).catch(() => {
      // Tolerate races / pre-existing config; booking config is best-effort.
    })
  }

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

export async function setServiceBookingTypes(
  token: string,
  serviceId: string,
  types: ServiceBookingTypeInput[]
): Promise<void> {
  await apiPut(`/dashboard/organization/services/${serviceId}/booking-types`, token, {
    types: types.map((type) => ({
      deliveryType: type.deliveryType ?? "IN_PERSON",
      durationMins: type.durationMins,
      price: type.price,
      isActive: type.isActive ?? true,
      useCustomAvailability: type.useCustomAvailability ?? false,
    })),
  })
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

export async function assignEmployeeToBranch(
  token: string,
  branchId: string,
  employeeId: string
): Promise<void> {
  await apiPost(`/dashboard/organization/branches/${branchId}/employees`, token, {
    employeeId,
  })
}

export async function setBranchBusinessHours(
  token: string,
  branchId: string
): Promise<void> {
  await apiPost("/dashboard/organization/hours", token, {
    branchId,
    schedule: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      isOpen: true,
    })),
  })
}

export async function setEmployeeAvailability(
  token: string,
  employeeId: string
): Promise<void> {
  await apiPatch(`/dashboard/people/employees/${employeeId}/availability`, token, {
    windows: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      isActive: true,
    })),
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

export async function ensureValidMainBranchId(token: string): Promise<string> {
  const suffix = uniqueSuffix()
  const created = await apiPost<{ id: string }>(
    "/dashboard/organization/branches",
    token,
    {
      nameAr: `فرع رحلة مستخدم ${suffix}`,
      nameEn: `Full Journey Branch ${suffix}`,
      isMain: true,
      isActive: true,
    }
  )

  await apiPatch(
    `/dashboard/organization/booking-settings?branchId=${created.id}`,
    token,
    {
      payAtClinicEnabled: true,
    }
  ).catch(() => undefined)

  return created.id
}

export async function prepareBookableSchedule(
  token: string,
  input: { branchId: string; employeeId: string }
): Promise<void> {
  await setBranchBusinessHours(token, input.branchId)
  await assignEmployeeToBranch(token, input.branchId, input.employeeId).catch(
    () => undefined
  )
  await setEmployeeAvailability(token, input.employeeId)
}

export async function cleanupBranch(
  branchId: string,
  token: string
): Promise<void> {
  // A branch can't be deleted while employees are still assigned (409). Unassign
  // any that prepareBookableSchedule attached before deleting the branch.
  const assigned = await apiGet<Array<{ employeeId: string }>>(
    `/dashboard/organization/branches/${branchId}/employees`,
    token
  ).catch(() => [] as Array<{ employeeId: string }>)
  for (const link of assigned) {
    await apiDelete(
      `/dashboard/organization/branches/${branchId}/employees/${link.employeeId}`,
      token
    ).catch(() => undefined)
  }

  // Delete the branch. A 409 here means the branch is still referenced by
  // bookings/waitlist/group sessions seeded during the test — that's correct
  // app behavior (you can't delete a branch with live bookings), and a leftover
  // test branch in the dev DB is harmless. Tolerate it so teardown doesn't fail
  // an otherwise-passing test; surface any other error.
  await apiDelete(`/dashboard/organization/branches/${branchId}`, token).catch(
    (err: unknown) => {
      if (/HTTP 409/.test(String((err as Error)?.message))) return
      throw err
    }
  )
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

  // Give the employee a 7-day 09:00–17:00 availability window so the booking
  // wizard's employee step shows them as bookable. Without it the wizard
  // disables the employee tile ("لا يوجد وقت متاح") and no time can be picked.
  // Best-effort: wizard-less seeds (cancel/payment flows) set availability via
  // seedBooking, so a failure here must not break those paths.
  if (overrides.skipAvailability !== true) {
    await setEmployeeAvailability(token, created.id).catch(() => undefined)
  }

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
// Track slots already consumed by this run so two seeds for the same employee
// never request the same start time. Keyed by `${employeeId}|${iso}`.
const consumedSlots = new Set<string>()

/**
 * Ask the backend for a genuinely-available slot instead of guessing a time.
 * This is robust against the engine's slot grid, service duration, branch
 * business hours, buffers, and bookings left over from earlier runs — all of
 * which made fixed-time seeds fail with "Selected booking time is not
 * available". Walks forward day-by-day (within maxAdvanceBookingDays) until it
 * finds a slot not yet consumed this run. Starts a few days out so the minimum
 * lead time is never an issue.
 */
async function findAvailableSlotIso(
  token: string,
  input: { branchId: string; employeeId: string; serviceId: string }
): Promise<string> {
  const MAX_DAYS = 80 // safely below the seeded maxAdvanceBookingDays (90)
  for (let dayOffset = 2; dayOffset <= MAX_DAYS; dayOffset++) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() + dayOffset)
    date.setUTCHours(0, 0, 0, 0)

    const qs = new URLSearchParams({
      employeeId: input.employeeId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: date.toISOString(),
      bookingType: "INDIVIDUAL",
    }).toString()

    const slots = await apiGet<Array<{ startTime: string }>>(
      `/dashboard/bookings/availability?${qs}`,
      token
    ).catch(() => [] as Array<{ startTime: string }>)

    for (const slot of slots) {
      const iso = new Date(slot.startTime).toISOString()
      const key = `${input.employeeId}|${iso}`
      if (!consumedSlots.has(key)) {
        consumedSlots.add(key)
        return iso
      }
    }
  }
  throw new Error(
    `[seed] no available slot found for employee ${input.employeeId} within ${MAX_DAYS} days`
  )
}

export async function seedBooking(
  token: string,
  input: SeedBookingInput
): Promise<SeededBooking> {
  // Ensure employee is assigned to the service
  await assignEmployeeToService(token, input.employeeId, input.serviceId).catch(
    () => {
      // 409 Conflict = already assigned; ignore
    }
  )

  // Resolve a valid branch UUID
  const branchId = input.branchId ?? (await ensureValidBranchId(token))

  await prepareBookableSchedule(token, {
    branchId,
    employeeId: input.employeeId,
  })

  // Honour a caller-pinned time; otherwise resolve a real, free slot from the
  // availability engine so the booking POST can't fail on slot validity.
  const scheduledAt =
    input.scheduledAt ??
    (await findAvailableSlotIso(token, {
      branchId,
      employeeId: input.employeeId,
      serviceId: input.serviceId,
    }))

  const created = await apiPost<{
    id: string
    clientId: string
    employeeId: string
    serviceId: string
    scheduledAt: string
    status: string
  }>("/dashboard/bookings", token, {
    branchId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt,
    payAtClinic: input.payAtClinic ?? false,
    bookingType: "INDIVIDUAL",
  })

  return {
    id: created.id,
    clientId: created.clientId,
    employeeId: created.employeeId,
    serviceId: created.serviceId,
    scheduledAt: created.scheduledAt,
    status: created.status,
  }
}

export async function createDashboardBooking(
  token: string,
  input: CreateDashboardBookingInput
): Promise<SeededBooking> {
  const created = await apiPost<{
    id: string
    clientId: string
    employeeId: string
    serviceId: string
    scheduledAt: string
    status: string
  }>("/dashboard/bookings", token, {
    branchId: input.branchId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt: input.scheduledAt,
    bookingType: input.bookingType ?? "INDIVIDUAL",
    deliveryType: input.deliveryType ?? "IN_PERSON",
    payAtClinic: input.payAtClinic ?? true,
    notes: input.notes,
  })

  return {
    id: created.id,
    clientId: created.clientId,
    employeeId: created.employeeId,
    serviceId: created.serviceId,
    scheduledAt: created.scheduledAt,
    status: created.status,
  }
}

export async function createRecurringDashboardBookings(
  token: string,
  input: CreateRecurringDashboardBookingInput
): Promise<SeededBooking[]> {
  const created = await apiPost<
    Array<{
      id: string
      clientId: string
      employeeId: string
      serviceId: string
      scheduledAt: string
      status: string
    }>
  >("/dashboard/bookings/recurring", token, {
    branchId: input.branchId,
    clientId: input.clientId,
    employeeId: input.employeeId,
    serviceId: input.serviceId,
    scheduledAt: input.scheduledAt,
    durationMins: input.durationMins,
    price: input.price,
    frequency: input.frequency,
    occurrences: input.occurrences,
    intervalDays: input.intervalDays,
    bookingType: input.bookingType ?? "INDIVIDUAL",
    deliveryType: input.deliveryType ?? "IN_PERSON",
    notes: input.notes,
    skipConflicts: input.skipConflicts,
  })

  return created.map((booking) => ({
    id: booking.id,
    clientId: booking.clientId,
    employeeId: booking.employeeId,
    serviceId: booking.serviceId,
    scheduledAt: booking.scheduledAt,
    status: booking.status,
  }))
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
  return apiPost<SeededInvoice>("/dashboard/finance/invoices", token, { ...input })
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
    { ...input }
  )
}
