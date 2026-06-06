import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import {
  cancelMyBooking,
  getMe,
  getMyBookings,
  rescheduleMyBooking,
  setMeBaseUrl,
} from '../me'
import type {
  ClientBookingListResponse,
  ClientProfile,
} from '@sawaa/shared'

const fakeProfile = {
  id: 'client_1',
  email: 'client@sawaa.app',
  name: 'Client One',
} as unknown as ClientProfile

let storedAccess: string | null = null
let onTokenRefreshed = vi.fn()
let onAuthFailure = vi.fn()

beforeEach(() => {
  storedAccess = null
  onTokenRefreshed = vi.fn()
  onAuthFailure = vi.fn()
  initClient({
    baseUrl: 'http://api.test/api/v1',
    getAccessToken: () => storedAccess,
    onTokenRefreshed,
    onAuthFailure,
  })
  setMeBaseUrl('http://api.test/api/v1')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getMe', () => {
  it('uses the central client refresh flow for public client endpoints', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'Expired' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { clientId: 'client_1' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: fakeProfile }))

    const profile = await getMe()

    expect(profile).toEqual(fakeProfile)
    expect(onTokenRefreshed).not.toHaveBeenCalled()
    expect(onAuthFailure).not.toHaveBeenCalled()

    const calls = vi.mocked(fetch).mock.calls
    expect(calls).toHaveLength(3)
    expect(calls[0]?.[0]).toBe('http://api.test/api/v1/public/me')
    expect(calls[1]?.[0]).toBe('http://api.test/api/v1/public/auth/refresh')
    expect(calls[2]?.[0]).toBe('http://api.test/api/v1/public/me')

    const refreshInit = calls[1]?.[1] as RequestInit
    expect((calls[0]?.[1] as RequestInit).credentials).toBe('include')
    expect(refreshInit.credentials).toBe('include')
    expect(JSON.parse(refreshInit.body as string)).toEqual({})
    expect((calls[2]?.[1] as RequestInit).credentials).toBe('include')
  })
})

describe('getMyBookings', () => {
  it('GETs /public/me/bookings with credentials and unwraps the envelope', async () => {
    const fakeBookings = { items: [], page: 2, pageSize: 5 } as unknown as ClientBookingListResponse
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: fakeBookings }),
    )

    const result = await getMyBookings(2, 5)

    expect(result).toEqual(fakeBookings)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/api/v1/public/me/bookings?page=2&pageSize=5')
    expect((init as RequestInit).credentials).toBe('include')
  })
})

describe('cancelMyBooking', () => {
  it('PATCHes /public/me/bookings/:id/cancel with payload', async () => {
    const fakeResult = {
      status: 'CANCELLED',
      booking: { id: 'booking_1' },
      requiresApproval: false,
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: fakeResult }),
    )

    const result = await cancelMyBooking('booking_1', { reason: 'changed plans' })

    expect(result).toEqual(fakeResult)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/api/v1/public/me/bookings/booking_1/cancel')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ reason: 'changed plans' })
  })
})

describe('rescheduleMyBooking', () => {
  it('PATCHes /public/me/bookings/:id/reschedule with payload', async () => {
    const fakeResult = { booking: { id: 'booking_1' } }
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: fakeResult }),
    )

    const result = await rescheduleMyBooking('booking_1', {
      newScheduledAt: '2026-06-06T12:00:00.000Z',
      newDurationMins: 60,
    })

    expect(result).toEqual(fakeResult)
    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe('http://api.test/api/v1/public/me/bookings/booking_1/reschedule')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({
      newScheduledAt: '2026-06-06T12:00:00.000Z',
      newDurationMins: 60,
    })
  })
})
