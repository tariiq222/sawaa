import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import {
  useLateSessionCatalog,
  useLateSessionExistingBookings,
} from '@/hooks/use-late-session-catalog'
const pages = (prefix: string, page = 1) => ({
  items: [
    { id: `${prefix}-${page}`, invoice: page === 2 ? { id: 'invoice' } : null },
  ],
  meta: { page, totalPages: 2, hasNextPage: page === 1 },
})
vi.mock('@/lib/api/services', () => ({
  fetchServices: vi.fn(async ({ page }: { page: number }) =>
    pages('service', page)
  ),
}))
vi.mock('@/lib/api/employees', () => ({
  fetchEmployees: vi.fn(async ({ page }: { page: number }) =>
    pages('employee', page)
  ),
}))
vi.mock('@/lib/api/branches', () => ({
  fetchBranches: vi.fn(async ({ page }: { page: number }) =>
    pages('branch', page)
  ),
}))
vi.mock('@/lib/api/bookings', () => ({
  fetchBookings: vi.fn(async ({ page }: { page: number }) =>
    pages('booking', page)
  ),
}))
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)
it('loads page-two historical services, practitioners and branches', async () => {
  const { result } = renderHook(() => useLateSessionCatalog(), { wrapper })
  await waitFor(() => expect(result.current.services).toHaveLength(2))
  expect(result.current.employees.map((e) => e.id)).toEqual([
    'employee-1',
    'employee-2',
  ])
  expect(result.current.branches.map((b) => b.id)).toEqual([
    'branch-1',
    'branch-2',
  ])
})
it('finds an invoice on page two behind non-invoiced bookings', async () => {
  const { result } = renderHook(
    () => useLateSessionExistingBookings('', true),
    { wrapper }
  )
  await waitFor(() => expect(result.current.data?.items).toHaveLength(2))
  expect(
    result.current.data?.items.filter((b) => b.invoice).map((b) => b.id)
  ).toEqual(['booking-2'])
})
