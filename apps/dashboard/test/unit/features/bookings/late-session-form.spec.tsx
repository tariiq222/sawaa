import { state, change } from './late-session-form-fixture'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { LateSessionForm } from '@/components/features/bookings/late-session-form'
it('defaults completed, shows receipt facts conditionally, and blocks external prior invoices', () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  expect(screen.getByLabelText('bookings.late.status')).toHaveValue('COMPLETED')
  expect(
    screen.queryByLabelText('bookings.late.receivedAt')
  ).not.toBeInTheDocument()
  change('paymentMode', 'PREVIOUSLY_RECEIVED')
  expect(screen.getByLabelText('bookings.late.receivedAt')).toBeInTheDocument()
  change('status', 'NO_SHOW')
  expect(
    screen.queryByLabelText('bookings.late.paymentAmount')
  ).not.toBeInTheDocument()
  expect(screen.getByLabelText('bookings.late.noShowAt')).toBeInTheDocument()
  change('priorInvoice', 'EXTERNAL')
  expect(
    screen.getByRole('button', { name: 'bookings.late.save' })
  ).toBeDisabled()
  expect(state.submit).not.toHaveBeenCalled()
})
it('selects archived bound direct-clinic refs, submits partial historical receipt atomically, and removes stale receipt fields', async () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('clientId', 'client')
  change('branchId', 'branch')
  change('clinic', 'clinic')
  change('amount', '400')
  change('employeeId', 'employee')
  expect(screen.queryByText('INTERNAL HIDDEN')).not.toBeInTheDocument()
  expect(screen.getByLabelText('bookings.late.amount')).toHaveValue('400')
  change('scheduledAt', '2025-01-02T10:00')
  change('paymentMode', 'PREVIOUSLY_RECEIVED')
  change('paymentAmount', '150')
  change('receivedAt', '2025-01-01T11:00')
  change('receiptEvidenceRef', 'receipt-1')
  change('receiptEntryReason', 'Late documentation')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalledTimes(1))
  expect(state.submit.mock.calls[0][0]).toMatchObject({
    clientId: 'client',
    branchId: 'branch',
    serviceId: 'service',
    employeeId: 'employee',
    amountHalalas: 40000,
    paymentAmountHalalas: 15000,
    scheduledAt: '2025-01-02T07:00:00.000Z',
    receivedAt: '2025-01-01T08:00:00.000Z',
    receiptEvidenceRef: 'receipt-1',
    receiptEntryReason: 'Late documentation',
  })
  change('paymentMode', 'UNPAID')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalledTimes(2))
  expect(state.submit.mock.calls[1][0]).not.toHaveProperty('receiptEvidenceRef')
  expect(state.submit.mock.calls[1][0]).not.toHaveProperty(
    'paymentAmountHalalas'
  )
  change('status', 'NO_SHOW')
  change('noShowAt', '2025-01-02T10:30')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalledTimes(3))
  expect(state.submit.mock.calls[2][0]).toMatchObject({
    amountHalalas: 0,
    paymentMode: 'UNPAID',
    status: 'NO_SHOW',
  })
})
it('opens the returned booking after showing remaining debt', () => {
  const booking = { id: 'saved' }
  state.data = {
    booking,
    outstanding: 25000,
    lateEntryRecordedAt: '2026-10-05T12:00:00Z',
  }
  const onSaved = vi.fn()
  render(
    <LateSessionForm
      onCancel={vi.fn()}
      onSaved={onSaved}
      onOpenExisting={onSaved}
    />
  )
  expect(screen.getByRole('status')).toHaveTextContent('250.00')
  fireEvent.click(
    screen.getByRole('button', { name: 'bookings.late.openBooking' })
  )
  expect(onSaved).toHaveBeenCalledWith(booking)
})

it('clears the selected client when searching again', () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('clientId', 'client')
  fireEvent.change(
    screen.getByLabelText('bookings.client.search.placeholder'),
    { target: { value: 'Other client' } }
  )
  expect(screen.getByLabelText('bookings.late.clientId')).toHaveValue('')
})
it.each(['pending', 'error'])(
  'blocks financial save when VAT policy is %s',
  (mode) => {
    state.settings = {
      data: undefined,
      isLoading: mode === 'pending',
      error: mode === 'error' ? new Error('offline') : null,
    }
    render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
    change('amount', '400')
    expect(
      screen.getByRole('button', { name: 'bookings.late.save' })
    ).toBeDisabled()
    expect(screen.queryByText(/bookings.late.total:/)).not.toBeInTheDocument()
  }
)
it('resolves DIRECT internally and requires an actual amount instead of hidden price', () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('branchId', 'branch')
  change('clinic', 'clinic')
  expect(
    screen.queryByLabelText('bookings.late.serviceId')
  ).not.toBeInTheDocument()
  expect(screen.getByLabelText('bookings.late.employeeId')).toHaveTextContent(
    'Archived Practitioner'
  )
  expect(screen.getByLabelText('bookings.late.amount')).toHaveValue('')
})

it('offers page-two clients and submits the newly visible selected client', async () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('clientId', 'client')
  fireEvent.click(
    screen.getByRole('button', { name: 'bookings.late.nextClients' })
  )
  expect(screen.getByLabelText('bookings.late.clientId')).toHaveValue('')
  expect(screen.getByLabelText('bookings.late.clientId')).toHaveTextContent(
    'Second Client'
  )
  change('clientId', 'client-2')
  change('branchId', 'branch')
  change('clinic', 'clinic')
  change('employeeId', 'employee')
  change('amount', '400')
  change('scheduledAt', '2025-01-02T10:00')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalled())
  expect(state.submit.mock.calls[0][0]).toMatchObject({ clientId: 'client-2' })
})
it('allows reception without Settings access to use nonzero VAT and VAT-inclusive receipt', async () => {
  state.canDo.mockImplementation((module) => module !== 'Setting')
  state.settings.data = { vatRate: 0.15, paymentMethods: ['CASH'] }
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('clientId', 'client')
  change('branchId', 'branch')
  change('clinic', 'clinic')
  change('employeeId', 'employee')
  change('amount', '400')
  change('scheduledAt', '2025-01-02T10:00')
  expect(screen.getByText(/bookings.late.total:/)).toHaveTextContent('460.00')
  change('paymentMode', 'PREVIOUSLY_RECEIVED')
  change('paymentAmount', '460')
  change('receivedAt', '2025-01-01T11:00')
  change('receiptEvidenceRef', 'R1')
  change('receiptEntryReason', 'Recorded late')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalled())
  expect(state.submit.mock.calls[0][0]).toMatchObject({
    amountHalalas: 40000,
    paymentAmountHalalas: 46000,
  })
})
it('denies invoice creation and hides payment controls without permissions', async () => {
  state.canDo.mockImplementation((module) => module === 'Booking')
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  expect(
    screen.queryByLabelText('bookings.late.paymentMode')
  ).not.toBeInTheDocument()
  change('amount', '400')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('common.noPermission')
  )
  expect(state.submit).not.toHaveBeenCalled()
})
it('opens an existing internal invoiced booking without creating a duplicate', () => {
  const booking = {
    id: 'existing',
    bookingNumber: 42,
    invoice: { id: 'invoice' },
    date: '2025-01-01',
  }
  state.existingItems = [booking]
  const onSaved = vi.fn()
  render(
    <LateSessionForm
      onCancel={vi.fn()}
      onSaved={onSaved}
      onOpenExisting={onSaved}
    />
  )
  change('priorInvoice', 'INTERNAL')
  fireEvent.click(screen.getByRole('button', { name: /#42/ }))
  expect(onSaved).toHaveBeenCalledWith(booking)
  expect(state.submit).not.toHaveBeenCalled()
})
it('retains explicit service choice for SERVICES categories', () => {
  state.bookingMode = 'SERVICES'
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('clinic', 'clinic')
  expect(screen.getByLabelText('bookings.late.serviceId')).toHaveValue('')
  change('serviceId', 'service')
  expect(screen.getByLabelText('bookings.late.serviceId')).toHaveValue(
    'service'
  )
})
it('keeps terminal zero amount when selecting references after choosing no-show', async () => {
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('status', 'NO_SHOW')
  change('clientId', 'client')
  change('branchId', 'branch')
  change('clinic', 'clinic')
  change('employeeId', 'employee')
  change('scheduledAt', '2025-01-02T10:00')
  change('noShowAt', '2025-01-02T11:00')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() => expect(state.submit).toHaveBeenCalled())
  expect(state.submit.mock.calls[0][0]).toMatchObject({
    amountHalalas: 0,
    paymentMode: 'UNPAID',
  })
})

it('shows translated duplicate conflict and opens its read-authorized existing booking', async () => {
  state.submit.mockRejectedValueOnce(
    new ApiError(
      409,
      'Conflicting session',
      { code: 'ALREADY_RECORDED_SESSION', bookingId: 'existing' },
      'ALREADY_RECORDED_SESSION'
    )
  )
  const onSaved = vi.fn()
  const onOpenExisting = vi.fn()
  state.openConflict.mockResolvedValue({ id: 'existing' })
  render(
    <LateSessionForm
      onCancel={vi.fn()}
      onSaved={onSaved}
      onOpenExisting={onOpenExisting}
    />
  )
  change('clientId', 'client')
  change('branchId', 'branch')
  change('clinic', 'clinic')
  change('employeeId', 'employee')
  change('amount', '400')
  change('scheduledAt', '2025-01-02T10:00')
  fireEvent.click(screen.getByRole('button', { name: 'bookings.late.save' }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'bookings.late.conflict'
    )
  )
  expect(
    screen.getByRole('button', { name: 'bookings.late.openExisting' })
  ).toBeInTheDocument()
  fireEvent.click(
    screen.getByRole('button', { name: 'bookings.late.openExisting' })
  )
  await waitFor(() =>
    expect(onOpenExisting).toHaveBeenCalledWith({ id: 'existing' })
  )
  expect(state.openConflict).toHaveBeenCalledWith('existing')
  expect(onSaved).not.toHaveBeenCalled()
  expect(screen.queryByText('bookings.late.saved')).not.toBeInTheDocument()
})
it('shows the decimal-safe VAT total at the half-halalah boundary', () => {
  state.settings.data = { vatRate: 0.145, paymentMethods: ['CASH'] }
  render(<LateSessionForm onCancel={vi.fn()} onSaved={vi.fn()} />)
  change('amount', '1')
  expect(screen.getByText(/bookings.late.total:/)).toHaveTextContent('1.15')
})
