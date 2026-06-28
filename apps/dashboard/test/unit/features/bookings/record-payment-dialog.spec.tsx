import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import type { Booking } from '@/lib/types/booking'

const applyDiscountMutateAsync = vi.fn().mockResolvedValue({})
const recordMutateAsync = vi.fn().mockResolvedValue({})

vi.mock('@/components/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({ canDo: () => true }),
}))

vi.mock('@/hooks/use-payments', () => ({
  useRecordPaymentMutations: () => ({
    applyDiscountMut: { mutateAsync: applyDiscountMutateAsync, isPending: false },
    recordMut: { mutateAsync: recordMutateAsync, isPending: false },
    ensureInvoiceMut: { mutateAsync: vi.fn().mockRejectedValue(new Error('no invoice')), isPending: false, isError: true },
  }),
}))

vi.mock('@/hooks/use-discount-reasons', () => ({
  useDiscountReasons: () => ({
    data: [{ id: 'reason-1', labelAr: 'خصم خاص', labelEn: null, isActive: true, sortOrder: 0, createdAt: '', updatedAt: '' }],
  }),
}))

vi.mock('@/hooks/use-organization-settings', () => ({
  usePaymentSettings: () => ({
    data: {
      paymentMoyasarEnabled: true,
      paymentAtClinicEnabled: true,
      payMethodCashEnabled: true,
      payMethodBankEnabled: false,
      payMethodMadaEnabled: true,
      payMethodTabbyEnabled: false,
    },
  }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RecordPaymentDialog } from '@/components/features/bookings/record-payment-dialog'

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    invoice: { id: 'inv-1', subtotal: 10000, vatRate: 0.15, total: 11500, outstanding: 11500, status: 'ISSUED' },
    payment: null,
    ...overrides,
  } as unknown as Booking
}

function renderDialog(booking: Booking) {
  return render(
    <RecordPaymentDialog booking={booking} open onOpenChange={() => {}} />,
  )
}

describe('RecordPaymentDialog', () => {
  beforeEach(() => {
    applyDiscountMutateAsync.mockClear()
    recordMutateAsync.mockClear()
  })

  it('seeds the amount field from the outstanding balance (115.00 SAR)', () => {
    renderDialog(makeBooking())
    const amount = screen.getByLabelText(/recordPayment.amount/) as HTMLInputElement
    expect(Number(amount.value)).toBe(115)
  })

  it('records a payment without discount: skips discount mutation', async () => {
    renderDialog(makeBooking())
    fireEvent.click(screen.getByText('bookings.recordPayment.submit'))
    await waitFor(() => expect(recordMutateAsync).toHaveBeenCalled())
    expect(applyDiscountMutateAsync).not.toHaveBeenCalled()
    expect(recordMutateAsync).toHaveBeenCalledWith({
      invoiceId: 'inv-1',
      amount: 11500, // 115 SAR → halalas
      method: 'CASH',
    })
  })

  it('blocks submission when a discount is entered without a reason', () => {
    renderDialog(makeBooking())
    const discount = screen.getByLabelText('bookings.recordPayment.discount')
    fireEvent.change(discount, { target: { value: '10' } })
    const submit = screen.getByText('bookings.recordPayment.submit').closest('button')!
    expect(submit).toBeDisabled()
  })

  it('reduces the payable amount cap when a discount is entered', () => {
    renderDialog(makeBooking())
    const amount = screen.getByLabelText(/recordPayment.amount/) as HTMLInputElement
    expect(Number(amount.max)).toBe(115)

    // Enter a 15 SAR discount on the 100 SAR subtotal → VAT recomputed on the
    // reduced base: (100 − 15) × 1.15 = 97.75 SAR payable.
    fireEvent.change(screen.getByLabelText('bookings.recordPayment.discount'), {
      target: { value: '15' },
    })
    expect(Number(amount.max)).toBeCloseTo(97.75, 2)
    // The discount-reason selector appears once a discount is entered.
    expect(screen.getByText('bookings.recordPayment.discountReason')).toBeInTheDocument()
  })

  it('renders only the payment methods enabled in settings', () => {
    renderDialog(makeBooking())
    const group = screen.getByRole('radiogroup')
    // Settings mock enables cash + mada, disables bank + tabby.
    expect(group.querySelectorAll('[role="radio"]').length).toBe(2)
    expect(screen.getByRole('radio', { name: 'bookings.recordPayment.method.cash' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'bookings.recordPayment.method.mada' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'bookings.recordPayment.method.tabby' })).not.toBeInTheDocument()
  })

  it('records the payment with the selected method', async () => {
    renderDialog(makeBooking())
    fireEvent.click(screen.getByRole('radio', { name: 'bookings.recordPayment.method.mada' }))
    fireEvent.click(screen.getByText('bookings.recordPayment.submit'))
    await waitFor(() => expect(recordMutateAsync).toHaveBeenCalled())
    expect(recordMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'MADA' }),
    )
  })

  it('shows no-invoice message when the booking has no invoice', () => {
    renderDialog(makeBooking({ invoice: null }))
    expect(screen.getByText('bookings.recordPayment.noInvoice')).toBeInTheDocument()
  })
})
