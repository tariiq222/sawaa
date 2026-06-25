import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useBookingFormState } from '@/components/features/bookings/use-booking-form-state'

describe('useBookingFormState', () => {
  it('starts with empty booking fields and pay-at-clinic selected', () => {
    const { result } = renderHook(() => useBookingFormState())
    const s = result.current.state
    expect(s.clientId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    expect(s.payAtClinic).toBe(true)
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
      result.current.selectType('IN_PERSON')
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
      result.current.selectType('IN_PERSON')
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

  it('setPayAtClinic updates the flag without affecting other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.setPayAtClinic(true)
    })
    expect(result.current.state.payAtClinic).toBe(true)
    expect(result.current.state.clientId).toBe('cli-1')
    act(() => { result.current.setPayAtClinic(false) })
    expect(result.current.state.payAtClinic).toBe(false)
  })

  it('setCouponCode stores the coupon without affecting other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.setCouponCode('SAVE20')
    })
    expect(result.current.state.couponCode).toBe('SAVE20')
    expect(result.current.state.clientId).toBe('cli-1')
    act(() => { result.current.setCouponCode(null) })
    expect(result.current.state.couponCode).toBeNull()
  })

  it('selectDeliveryType resets date and time but preserves other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    act(() => {
      result.current.selectDeliveryType('ONLINE')
    })
    expect(result.current.state.deliveryType).toBe('ONLINE')
    expect(result.current.state.date).toBeNull()
    expect(result.current.state.startTime).toBeNull()
    expect(result.current.state.clientId).toBe('cli-1')
    expect(result.current.state.serviceId).toBe('svc-1')
  })

  it('selectTime sets startTime without resetting other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('IN_PERSON')
      result.current.selectDate('2026-06-01')
    })
    act(() => {
      result.current.selectTime('14:30')
    })
    expect(result.current.state.startTime).toBe('14:30')
    expect(result.current.state.date).toBe('2026-06-01')
    expect(result.current.state.clientId).toBe('cli-1')
  })

  it('selectDate clears previously-set startTime but preserves other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    act(() => {
      result.current.selectDate('2026-06-02')
    })
    expect(result.current.state.date).toBe('2026-06-02')
    expect(result.current.state.startTime).toBeNull()
    expect(result.current.state.clientId).toBe('cli-1')
  })

  it('isComplete is false when payAtClinic is set but required fields are missing', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.setPayAtClinic(true)
    })
    expect(result.current.isComplete).toBe(false)
  })

  it('isComplete is true with all required fields plus payAtClinic and coupon', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
      result.current.setPayAtClinic(true)
      result.current.setCouponCode('SAVE20')
    })
    expect(result.current.isComplete).toBe(true)
  })

  it('selectType resets downstream fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    act(() => {
      result.current.selectType('ONLINE')
    })
    const s = result.current.state
    expect(s.type).toBe('ONLINE')
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it('isComplete is true when all required fields are set', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    expect(result.current.isComplete).toBe(true)
  })

  it('applyCreditTarget fills the path and clears delivery/date/time', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => result.current.selectClient('c1', 'محمد'))
    act(() =>
      result.current.applyCreditTarget({
        departmentId: 'dep1', departmentName: 'قسم',
        categoryId: 'cat1', categoryName: 'عيادة', categoryBookingMode: 'SERVICES',
        serviceId: 's1', serviceName: 'خدمة',
        employeeId: 'e1', employeeName: 'موظف',
        durationOptionId: 'd1',
      }),
    )
    const s = result.current.state
    expect(s).toEqual(expect.objectContaining({
      clientId: 'c1', departmentId: 'dep1', categoryId: 'cat1',
      categoryBookingMode: 'SERVICES', serviceId: 's1', employeeId: 'e1',
      durationOptionId: 'd1', deliveryType: null, date: null, startTime: null,
    }))
  })
})
