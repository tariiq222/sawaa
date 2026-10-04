import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { CancellationTab } from '@/components/features/settings/cancellation-tab'

// jsdom does not implement pointer capture / scrolling used by Radix Select.
const browserMethods = ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const
const originalMethods = browserMethods.map((key) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
beforeAll(() => browserMethods.forEach((key) => Object.defineProperty(HTMLElement.prototype, key, { configurable: true, value: vi.fn(() => false) })))
afterAll(() => browserMethods.forEach((key, index) => {
  const descriptor = originalMethods[index]
  if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, key)
}))

const state = vi.hoisted(() => ({ settings: {} as Record<string, unknown>, mutate: vi.fn() }))
vi.mock('@/hooks/use-organization-settings', () => ({
  useBookingSettings: () => ({ data: state.settings, isLoading: false }),
  useBookingSettingsMutation: () => ({ mutate: state.mutate, isPending: false }),
}))
const defaults = {
  freeCancelBeforeHours: 0, freeCancelRefundType: 'FULL', lateCancelRefundPercent: 20,
  clientCancellationPolicyEnabled: false, clientCancelCutoffMode: null,
  clientCancelBeforeHours: null, earlyCancelRefundPercent: null,
  requireCancelApproval: true, autoRefundOnCancel: false,
}
const t = (key: string) => key
beforeEach(() => { state.settings = { ...defaults }; state.mutate.mockClear() })

describe('cancellation policy form', () => {
  it('always shows late refund percentage even when early refund is full', () => {
    render(<CancellationTab t={t} />)
    expect(screen.getByText('settings.lateRefundPercent')).toBeInTheDocument()
  })
  it('keeps zero hours and disabled legacy settings when saving', () => {
    render(<CancellationTab t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(state.mutate.mock.calls[0][0]).toMatchObject({
      freeCancelBeforeHours: 0, lateCancelRefundPercent: 20,
      requireCancelApproval: true, autoRefundOnCancel: false, clientCancellationPolicyEnabled: false,
    })
  })
  it('shows independent percentages and immediate cancellation text for an enabled policy', () => {
    state.settings = { ...defaults, clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0, freeCancelRefundType: 'PARTIAL', earlyCancelRefundPercent: 80 }
    render(<CancellationTab t={t} />)
    expect(screen.getByText('settings.earlyRefundPercent')).toBeInTheDocument()
    expect(screen.queryByText('settings.requireCancelApproval')).not.toBeInTheDocument()
    expect(screen.getByText('settings.clientCancellationImmediate')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(state.mutate.mock.calls[0][0]).toMatchObject({ clientCancelBeforeHours: 0, earlyCancelRefundPercent: 80, lateCancelRefundPercent: 20 })
    expect(state.mutate.mock.calls[0][0]).not.toHaveProperty('requireCancelApproval')
  })
  it('requires explicit cutoff configuration and retains a zero cutoff', () => {
    state.settings = { ...defaults, clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START' }
    render(<CancellationTab t={t} />)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('settings.clientCancelBeforeHours'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(state.mutate.mock.calls[0][0].clientCancelBeforeHours).toBe(0)
  })
  it('changes to attendance cutoff without inventing hours', async () => {
    const user = userEvent.setup()
    state.settings = { ...defaults, clientCancellationPolicyEnabled: true }
    render(<CancellationTab t={t} />)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    await user.click(screen.getByRole('combobox', { name: 'settings.clientCancelCutoffMode' }))
    await user.click(screen.getByRole('option', { name: 'settings.clientCutoffBeforeCheckIn' }))
    expect(screen.queryByLabelText('settings.clientCancelBeforeHours')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(state.mutate.mock.calls[0][0]).toMatchObject({ clientCancelCutoffMode: 'BEFORE_CHECK_IN', clientCancelBeforeHours: null })
    await user.click(screen.getByRole('combobox', { name: 'settings.clientCancelCutoffMode' }))
    await user.click(screen.getByRole('option', { name: 'settings.clientCutoffBeforeStart' }))
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
  })
  it('rejects missing early percentage without borrowing the late percentage', () => {
    state.settings = { ...defaults, clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_CHECK_IN', freeCancelRefundType: 'PARTIAL' }
    render(<CancellationTab t={t} />)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('settings.earlyRefundPercent'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'settings.save' }))
    expect(state.mutate.mock.calls[0][0]).toMatchObject({ earlyCancelRefundPercent: 0, lateCancelRefundPercent: 20 })
  })

})
