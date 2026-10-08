import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ fetchEmployee: vi.fn(), fetchEmployees: vi.fn() }))
vi.mock('@/lib/api/employees', () => mocks)
import { useEmployee, useAllEmployees } from '@/hooks/use-employees'
import { queryKeys } from '@/lib/query-keys'

describe('employee signed image cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchEmployee.mockResolvedValue({ id: 'e1', avatarUrl: 'https://files.sawaa.sa/fresh' })
    mocks.fetchEmployees.mockResolvedValue({ items: [{ id: 'e1', avatarUrl: 'https://files.sawaa.sa/fresh' }] })
  })
  it.each(['detail', 'list'] as const)('refreshes %s image URLs before five-minute signatures expire', async (kind) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const key = kind === 'detail' ? queryKeys.employees.detail('e1') : queryKeys.employees.list({ page: 1, limit: 200 })
    client.setQueryData(key, kind === 'detail' ? { id: 'e1', avatarUrl: 'https://files.sawaa.sa/old' } : { items: [] }, { updatedAt: Date.now() - 4 * 60 * 1000 })
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const hook = renderHook(() => kind === 'detail' ? useEmployee('e1') : useAllEmployees(), { wrapper })
    await waitFor(() => expect(kind === 'detail' ? mocks.fetchEmployee : mocks.fetchEmployees).toHaveBeenCalled())
    hook.unmount()
    client.clear()
  })
})
