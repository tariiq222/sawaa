import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import * as lateApi from '@/lib/api/late-session'
import { lateSessionConflict } from '@/components/features/bookings/late-session-conflict'
import {
  buildLateSessionPayload,
  defaultLateSessionDraft,
} from '@/lib/schemas/late-session.schema'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('requests only the reception late-entry context route', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValue({ vatRate: 0.15, paymentMethods: ['CASH'] })
  expect(await lateApi.fetchLateSessionContext()).toEqual({
    vatRate: 0.15,
    paymentMethods: ['CASH'],
  })
  expect(get).toHaveBeenCalledExactlyOnceWith(
    '/dashboard/bookings/late-entry/context'
  )
})
it('preserves canonical HTTP409 conflict facts through the real API error adapter', async () => {
  const body = {
    statusCode: 409,
    error: 'CONFLICT',
    message: 'Conflicting session',
    code: 'ALREADY_RECORDED_SESSION',
    bookingId: 'existing',
    requestId: 'request',
    timestamp: '2026-10-05T12:00:00Z',
    path: '/api/v1/dashboard/bookings/late-entry',
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        })
    )
  )
  const payload = buildLateSessionPayload(
    {
      ...defaultLateSessionDraft,
      clientId: 'c',
      employeeId: 'e',
      branchId: 'b',
      serviceId: 's',
      scheduledAt: '2025-01-01T10:00',
    },
    'key'
  )
  const error = await lateApi.recordLateSession(payload).catch((error) => error)
  expect(error).toMatchObject({
    status: 409,
    code: 'ALREADY_RECORDED_SESSION',
    body,
  })
  expect(lateSessionConflict(error)).toEqual({ bookingId: 'existing' })
})
