import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useBookingFormState } from '@/components/features/bookings/use-booking-form-state'

describe('useBookingFormState', () => {
  it('starts with all fields null/false', () => {
    const { result } = renderHook(() => useBookingFormState())
    const s = result.current.state
    expect(s.clientId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    expect(s.payAtClinic).toBe(false)
    expect(result.current.isComplete).toBe(false)
  })

  it('selectService clears a previously-set employeeId', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectEmployee('emp-1', 'Ahmad')
    })
    expect(result.current.state.employeeId).toBe('emp-1')
    act(() => {
      result.current.selectService('svc-2', 'Family Therapy')
    })
    expect(result.current.state.serviceId).toBe('svc-2')
    expect(result.current.state.employeeId).toBeNull()
  })

  it('isComplete flips true once all required fields are set', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('in_person')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    expect(result.current.isComplete).toBe(true)
  })

  it('selectClient resets all downstream fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('in_person')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    act(() => {
      result.current.selectClient('cli-2', 'Nora')
    })
    const s = result.current.state
    expect(s.clientId).toBe('cli-2')
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it('reset brings everything back to initial state', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.state.clientId).toBeNull()
    expect(result.current.state.serviceId).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })
})
