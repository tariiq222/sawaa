import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { useRecordLateSession } from '@/hooks/use-record-late-session'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }))
it('uses one atomic request, retains retry key, and rotates for an edited draft', async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useRecordLateSession(), { wrapper })
  const payload = { clientId:'c', branchId:'b', serviceId:'s', employeeId:'e', deliveryType:'IN_PERSON' as const, scheduledAt:'2026-01-01T07:00:00Z', durationMins:60, status:'COMPLETED' as const, amountHalalas:40000, paymentMode:'UNPAID' as const }
  vi.mocked(api.post).mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ booking: { id:'saved' }, outstanding:40000 })
  await act(async () => { await result.current.submit(payload).catch(() => {}) })
  await act(async () => { await result.current.submit(payload).catch(() => {}) })
  const calls = vi.mocked(api.post).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0][0]).toBe('/dashboard/bookings/late-entry')
  expect(calls[1][1]).toEqual(calls[0][1])
  await act(async () => { await result.current.submit({ ...payload, amountHalalas:30000 }) })
  expect(calls[2][1]).not.toEqual(calls[0][1])
  await waitFor(() => expect(result.current.data).toMatchObject({ booking: { id:'saved' }, outstanding:40000 }))
})
