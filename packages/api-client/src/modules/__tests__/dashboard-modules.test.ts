import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  getBooking,
  listBookings,
} from '../bookings'
import {
  assignEmployeeService,
  createEmployee,
  createEmployeeVacation,
  deleteEmployee,
  deleteEmployeeVacation,
  getEmployee,
  getEmployeeBreaks,
  getEmployeeServices,
  getEmployeeVacations,
  listEmployees,
  setEmployeeBreaks,
  updateEmployee,
  updateEmployeeService,
} from '../employees'
import {
  applyInvoiceDiscount,
  getPayment,
  getPaymentStats,
  listPayments,
  processPayment,
  refundPayment,
  verifyPayment,
} from '../payments'

let storedAccess = 'access.jwt'
let onTokenRefreshed = vi.fn()
let onAuthFailure = vi.fn()

beforeEach(() => {
  storedAccess = 'access.jwt'
  onTokenRefreshed = vi.fn()
  onAuthFailure = vi.fn()
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => storedAccess,
    onTokenRefreshed,
    onAuthFailure,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function okJson(body: unknown): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest() {
  const call = vi.mocked(fetch).mock.calls.at(-1)
  if (!call) throw new Error('Expected fetch to be called')
  return call
}

function authHeader(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

// ─── Bookings ────────────────────────────────────────────────────────────────

describe('bookings module', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () => okJson({ id: 'booking-1' }))
  })

  it('builds booking list query params (omits undefined/null fields)', async () => {
    await listBookings({
      page: 2,
      limit: 25,
      status: 'confirmed',
      employeeId: 'emp-1',
    })
    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/bookings?page=2&limit=25&status=confirmed&employeeId=emp-1',
    )
  })

  it('omits the query string entirely when no params are provided', async () => {
    await listBookings()
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/bookings')
  })

  it('GETs /dashboard/bookings/:id with the bearer token', async () => {
    await getBooking('booking-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/bookings/booking-1')
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('POSTs a new booking and serializes the payload', async () => {
    await createBooking({
      employeeId: 'emp-1',
      serviceId: 'svc-1',
      date: '2026-06-07',
      startTime: '10:00',
      type: 'individual',
      deliveryType: 'IN_PERSON',
    })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/bookings')
    expect(init?.method).toBe('POST')
    expect(authHeader(init)).toBe('Bearer access.jwt')
    expect(JSON.parse(init?.body as string)).toMatchObject({
      employeeId: 'emp-1',
      serviceId: 'svc-1',
    })
  })

  it('PATCHes the booking cancel endpoint with optional reason', async () => {
    await cancelBooking('booking-1', { reason: 'Client request' })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/bookings/booking-1/cancel')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ reason: 'Client request' })
  })

  it('PATCHes the booking confirm endpoint with no body', async () => {
    await confirmBooking('booking-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/bookings/booking-1/confirm')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBeUndefined()
  })

  it('PATCHes the booking complete endpoint with no body', async () => {
    await completeBooking('booking-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/bookings/booking-1/complete')
    expect(init?.method).toBe('PATCH')
    expect(init?.body).toBeUndefined()
  })

  it('throws ApiError when the booking endpoint returns 404', async () => {
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(
      errJson({ message: { error: 'NOT_FOUND', message: 'No booking' } }, 404),
    )

    await expect(getBooking('missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'NOT_FOUND',
      message: 'No booking',
    })
  })
})

// ─── Employees ───────────────────────────────────────────────────────────────

describe('employees module', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () => okJson({ id: 'emp-1' }))
  })

  it('builds employee list query params', async () => {
    await listEmployees({ page: 1, limit: 10, isActive: true })
    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/people/employees?page=1&limit=10&isActive=true',
    )
  })

  it('assigns a service to an employee via POST', async () => {
    await assignEmployeeService('emp-1', {
      serviceId: 'svc-1',
      availableTypes: ['IN_PERSON'],
    })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees/emp-1/services')
    expect(init?.method).toBe('POST')
    expect(authHeader(init)).toBe('Bearer access.jwt')
    expect(JSON.parse(init?.body as string)).toEqual({
      serviceId: 'svc-1',
      availableTypes: ['IN_PERSON'],
    })
  })

  it('PUTs breaks for an employee', async () => {
    await setEmployeeBreaks('emp-1', {
      breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
    })
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/breaks',
    )
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({
      breaks: [{ dayOfWeek: 1, startTime: '12:00', endTime: '13:00' }],
    })
  })

  it('PATCHes a single employee service', async () => {
    await updateEmployeeService('emp-1', 'svc-1', { availableTypes: ['ONLINE'] })
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/services/svc-1',
    )
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      availableTypes: ['ONLINE'],
    })
  })

  it('GETs /dashboard/people/employees/:id (bearer token attached)', async () => {
    await getEmployee('emp-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees/emp-1')
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('POSTs a new employee with the payload', async () => {
    await createEmployee({
      userId: 'user-1',
      specialty: 'family-therapy',
      experience: 5,
    })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      userId: 'user-1',
      specialty: 'family-therapy',
      experience: 5,
    })
  })

  it('PATCHes an employee update with the payload', async () => {
    await updateEmployee('emp-1', { specialty: 'couples-therapy', isActive: false })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees/emp-1')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      specialty: 'couples-therapy',
      isActive: false,
    })
  })

  it('DELETEs an employee (no body)', async () => {
    await deleteEmployee('emp-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees/emp-1')
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
  })

  it('GETs /dashboard/people/employees/:id/breaks', async () => {
    await getEmployeeBreaks('emp-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/people/employees/emp-1/breaks')
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('GETs /dashboard/people/employees/:id/vacations', async () => {
    await getEmployeeVacations('emp-1')
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/vacations',
    )
    expect(init?.method).toBeUndefined()
  })

  it('POSTs a new vacation for an employee', async () => {
    await createEmployeeVacation('emp-1', {
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      reason: 'annual leave',
    })
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/vacations',
    )
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-15',
      reason: 'annual leave',
    })
  })

  it('DELETEs a vacation', async () => {
    await deleteEmployeeVacation('emp-1', 'vac-1')
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/vacations/vac-1',
    )
    expect(init?.method).toBe('DELETE')
  })

  it('GETs /dashboard/people/employees/:id/services', async () => {
    await getEmployeeServices('emp-1')
    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/people/employees/emp-1/services',
    )
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('throws ApiError on employee delete failure', async () => {
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(
      errJson({ error: 'FORBIDDEN', message: 'No access' }, 403),
    )

    await expect(listEmployees()).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })
})

// ─── Payments ────────────────────────────────────────────────────────────────

describe('payments module', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () => okJson({ id: 'pay-1' }))
  })

  it('GETs the payment detail endpoint with the bearer token', async () => {
    await getPayment('pay-1')
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/payments/pay-1')
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('PATCHes the refund endpoint with reason+amount', async () => {
    await refundPayment('pay-1', { reason: 'Duplicate', amount: 50 })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/payments/pay-1/refund')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      reason: 'Duplicate',
      amount: 50,
    })
  })

  it('PATCHes the verify endpoint with action+transferRef', async () => {
    await verifyPayment('pay-1', { action: 'approve', transferRef: 'TRF-1' })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/payments/pay-1/verify')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      action: 'approve',
      transferRef: 'TRF-1',
    })
  })

  it('throws ApiError on a refund error (e.g. refund window closed)', async () => {
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(
      errJson(
        { message: { error: 'REFUND_WINDOW_CLOSED', message: 'Too late' } },
        422,
      ),
    )

    await expect(
      refundPayment('pay-1', { reason: 'Late request' }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'REFUND_WINDOW_CLOSED',
      message: 'Too late',
    })
  })

  it('builds listPayments query params (omits undefined fields)', async () => {
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(
      okJson({ items: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }),
    )

    await listPayments({ page: 3, limit: 25, status: 'COMPLETED', method: 'CASH' })

    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/finance/payments?page=3&limit=25&status=COMPLETED&method=CASH',
    )
  })

  it('GETs /dashboard/finance/payments/stats (no body)', async () => {
    const fakeStats = {
      total: 100,
      totalAmount: 50000,
      completed: 80,
      completedAmount: 40000,
      pending: 10,
      pendingAmount: 5000,
      pendingVerification: 5,
      pendingVerificationAmount: 2500,
      refunded: 3,
      refundedAmount: 1500,
      failed: 2,
    }
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(okJson(fakeStats))

    const result = await getPaymentStats()

    expect(result).toEqual(fakeStats)
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/payments/stats')
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('POSTs a manual payment to /dashboard/finance/payments', async () => {
    await processPayment({
      invoiceId: 'inv-1',
      amount: 25000, // halalas
      method: 'CASH',
      gatewayRef: 'rcpt-42',
    })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/payments')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      invoiceId: 'inv-1',
      amount: 25000,
      method: 'CASH',
      gatewayRef: 'rcpt-42',
    })
  })

  it('PATCHes an invoice discount', async () => {
    await applyInvoiceDiscount('inv-1', {
      discountAmt: 500,
      discountReasonId: 'reason-1',
      note: 'goodwill',
    })
    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/finance/invoices/inv-1/discount')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      discountAmt: 500,
      discountReasonId: 'reason-1',
      note: 'goodwill',
    })
  })
})
