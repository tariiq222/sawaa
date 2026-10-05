import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { useBookings } from '@/hooks/use-bookings'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn().mockResolvedValue({ items:[], meta:{} }) } }))
it('sends the explicit late-entry filter without marking ordinary requests and resets it', async () => {
  const client = new QueryClient({ defaultOptions:{ queries:{ retry:false } } })
  const wrapper = ({ children }: { children:React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useBookings(), { wrapper })
  await waitFor(() => expect(api.get).toHaveBeenCalled())
  expect(vi.mocked(api.get).mock.calls[0][1]).toMatchObject({ isLateEntry:undefined })
  act(() => result.current.setFilters({ isLateEntry:true }))
  await waitFor(() => expect(vi.mocked(api.get).mock.calls.at(-1)?.[1]).toMatchObject({ isLateEntry:true }))
  expect(result.current.hasFilters).toBe(true)
  act(() => result.current.resetFilters())
  expect(result.current.filters.isLateEntry).toBe('all')
})
