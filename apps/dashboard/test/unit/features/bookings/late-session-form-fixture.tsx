import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
const state = vi.hoisted(() => ({
  submit: vi.fn(),
  openConflict: vi.fn(),
  data: undefined as unknown,
  bookingMode: 'DIRECT',
  existingItems: [] as {
    id: string
    bookingNumber: number
    invoice: { id: string }
    date: string
  }[],
  canDo: vi.fn((_module: string, _action: string) => true),
  settings: {
    data: { vatRate: 0, paymentMethods: ['CASH'] },
    isLoading: false,
    error: null,
  } as {
    data?: { vatRate: number; paymentMethods: string[] }
    isLoading: boolean
    error: Error | null
  },
}))
vi.mock('@/components/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}))
vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ canDo: state.canDo }),
}))
vi.mock('@/hooks/use-clients', () => ({
  useClients: () => {
    const [page, setPage] = React.useState(1)
    const [search, setSearch] = React.useState('')
    const second = page === 2 || search.length > 0
    return {
      clients: [
        {
          id: second ? 'client-2' : 'client',
          firstName: second ? 'Second' : 'First',
          lastName: 'Client',
        },
      ],
      search,
      setSearch,
      page,
      setPage,
      meta: { hasNextPage: page === 1, hasPreviousPage: page === 2 },
      isFetching: false,
    }
  },
}))
vi.mock('@/hooks/use-late-session-catalog', () => ({
  useLateSessionExistingBookings: () => ({
    data: { items: state.existingItems },
  }),
  useLateSessionCatalog: () => ({
    branches: [{ id: 'branch', nameAr: 'Main' }],
    services: [
      {
        id: 'service',
        nameAr: 'INTERNAL HIDDEN',
        categoryId: 'clinic',
        category: {
          id: 'clinic',
          nameAr: 'Direct clinic',
          bookingMode: state.bookingMode,
          isActive: false,
        },
        price: 0,
        durationMins: 60,
        isActive: false,
        archivedAt: '2025-01-01',
        isHidden: state.bookingMode === 'DIRECT',
      },
    ],
    employees: [
      {
        id: 'employee',
        user: { firstName: 'Archived', lastName: 'Practitioner' },
        serviceIds: ['service'],
        branchIds: ['branch'],
        isActive: false,
      },
    ],
    loading: false,
  }),
}))
vi.mock('@/hooks/use-late-session-context', () => ({
  useLateSessionContext: () => state.settings,
  useOpenLateSessionConflict: () => ({
    mutateAsync: state.openConflict,
    isPending: false,
  }),
}))
vi.mock('@/hooks/use-record-late-session', () => ({
  useRecordLateSession: () => ({
    isPending: false,
    submit: state.submit,
    data: state.data,
  }),
}))
export const change = (field: string, value: string) =>
  fireEvent.change(screen.getByLabelText(`bookings.late.${field}`), {
    target: { value },
  })
beforeEach(() => {
  state.data = undefined
  state.existingItems = []
  state.bookingMode = 'DIRECT'
  state.submit.mockReset()
  state.canDo.mockReturnValue(true)
  state.settings = {
    data: { vatRate: 0, paymentMethods: ['CASH'] },
    isLoading: false,
    error: null,
  }
})

export { state }
