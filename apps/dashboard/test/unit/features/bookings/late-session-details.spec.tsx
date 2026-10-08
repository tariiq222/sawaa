import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { LateSessionDetails } from '@/components/features/bookings/late-session-details'
import type { Booking } from '@/lib/types/booking'
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (k: string) => k, locale: 'en' }) }))
it('distinguishes actual receipt time from entry time and leaves ordinary sessions unmarked', () => {
  const booking = { isLateEntry:true, lateEntryRecordedAt:'2026-10-05T12:00:00Z', lateEntryRecordedBy:'staff', payment:{ effectiveReceivedAt:'2026-10-01T08:00:00Z', createdAt:'2026-10-05T12:00:00Z' } } as Booking
  const { rerender } = render(<LateSessionDetails booking={booking} />)
  expect(screen.getByText(/bookings.late.receivedAt/)).toHaveTextContent('10/1/2026')
  expect(screen.getByText(/bookings.late.receiptRecordedAt/)).toHaveTextContent('10/5/2026')
  rerender(<LateSessionDetails booking={{ ...booking, isLateEntry:false }} />)
  expect(screen.queryByText('bookings.late.title')).not.toBeInTheDocument()
})
