import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import {
  cancelBooking,
  createBooking,
  listBookings,
} from '../bookings'
import {
  assignEmployeeService,
  listEmployees,
} from '../employees'
import {
  getPayment,
  refundPayment,
  verifyPayment,
} from '../payments'

beforeEach(() => {
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => 'access.jwt',
    onTokenRefreshed: () => undefined,
    onAuthFailure: () => undefined,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mockJsonResponse(body: unknown): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest() {
  const call = vi.mocked(fetch).mock.calls.at(-1)
  if (!call) throw new Error('Expected fetch to be called')
  return call
}

describe('dashboard api modules', () => {
  it('builds booking list query params and writes booking mutations', async () => {
    vi.mocked(fetch).mockImplementation(async () => mockJsonResponse({ id: 'booking-1' }))

    await listBookings({ page: 2, perPage: 25, status: 'confirmed', employeeId: 'emp-1' })
    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/bookings?page=2&limit=25&status=confirmed&employeeId=emp-1',
    )

    await createBooking({
      employeeId: 'emp-1',
      serviceId: 'svc-1',
      date: '2026-06-07',
      startTime: '10:00',
      type: 'individual',
      deliveryType: 'IN_PERSON',
    })
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/bookings')
    expect(lastRequest()[1]?.method).toBe('POST')
    expect(JSON.parse(lastRequest()[1]?.body as string)).toMatchObject({
      employeeId: 'emp-1',
      serviceId: 'svc-1',
    })

    await cancelBooking('booking-1', { reason: 'Client request' })
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/bookings/booking-1/cancel')
    expect(lastRequest()[1]?.method).toBe('PATCH')
  })

  it('builds employee list query params and service assignment mutation', async () => {
    vi.mocked(fetch).mockImplementation(async () => mockJsonResponse({ id: 'emp-1' }))

    await listEmployees({ page: 1, perPage: 10, isActive: true })
    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/people/employees?page=1&limit=10&isActive=true',
    )

    await assignEmployeeService('emp-1', {
      serviceId: 'svc-1',
      availableTypes: ['IN_PERSON'],
    })
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/people/employees/emp-1/services')
    expect(lastRequest()[1]?.method).toBe('POST')
  })

  it('uses payment detail, refund, and verification endpoints', async () => {
    vi.mocked(fetch).mockImplementation(async () => mockJsonResponse({ id: 'pay-1' }))

    await getPayment('pay-1')
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/finance/payments/pay-1')

    await refundPayment('pay-1', { reason: 'Duplicate', amount: 50 })
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/finance/payments/pay-1/refund')
    expect(lastRequest()[1]?.method).toBe('PATCH')

    await verifyPayment('pay-1', { action: 'approve', transferRef: 'TRF-1' })
    expect(lastRequest()[0]).toBe('http://api.test/dashboard/finance/payments/pay-1/verify')
    expect(lastRequest()[1]?.method).toBe('PATCH')
  })
})
