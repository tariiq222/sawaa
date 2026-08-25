import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useBookingFormState } from '@/components/features/bookings/use-booking-form-state'
import { buildCreditFilter } from '@/lib/booking-credit-filter'
import type { PackageCreditConstraint } from '@/lib/types/package-purchase'

const buildFlexibleFilter = (
  purchaseId: string,
  constraints: PackageCreditConstraint[] = [],
  serviceId: string | null = null,
  employeeId: string | null = null,
  durationOptionId: string | null = null,
) =>
  buildCreditFilter(
    {
      id: 'credit-1',
      constraints,
      serviceId,
      employeeId,
      durationOptionId,
    },
    purchaseId,
    'باقة استشارات',
  )

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
    expect(s.collectionMethod).toBe('CASH')
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

  // W2-T2 — collection-method default + setter for the
  // "تحصيل الآن" path. Default must be "CASH" so the shared
  // PaymentMethodPicker has a stable seed before settings load.
  it('default collectionMethod is CASH so the picker has a stable seed', () => {
    const { result } = renderHook(() => useBookingFormState())
    expect(result.current.state.collectionMethod).toBe('CASH')
  })

  it('setCollectionMethod updates the manual method without affecting other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('cli-1', 'Sara')
      result.current.setCollectionMethod('BANK_TRANSFER')
    })
    expect(result.current.state.collectionMethod).toBe('BANK_TRANSFER')
    expect(result.current.state.clientId).toBe('cli-1')
    act(() => { result.current.setCollectionMethod('MADA') })
    expect(result.current.state.collectionMethod).toBe('MADA')
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

  // Phase 6 — three-track booking wizard state machine.

  it('selectTrack clears every downstream selection but preserves client', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.selectDepartment('d1', 'Family')
      result.current.selectCategory('cat1', 'Marriage', 'SERVICES')
      result.current.selectService('s1', 'Counseling')
      result.current.selectEmployee('e1', 'Ahmad')
      result.current.selectDeliveryType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
      result.current.selectProgram('p1', 'Parenting')
      result.current.applyPackageCreditTarget(
        {
          departmentId: 'd2', departmentName: 'dept2',
          categoryId: 'cat2', categoryName: 'cat2', categoryBookingMode: 'SERVICES',
          serviceId: 's2', serviceName: 'svc2',
          employeeId: 'e2', employeeName: 'emp2',
          durationOptionId: 'dur2',
        },
        'pkg-purchase-1',
      )
    })
    act(() => result.current.selectTrack('GROUP'))
    const s = result.current.state
    expect(s.track).toBe('GROUP')
    expect(s.clientId).toBe('c1')
    expect(s.departmentId).toBeNull()
    expect(s.categoryId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.deliveryType).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    expect(s.programId).toBeNull()
    expect(s.programName).toBeNull()
    expect(s.packagePurchaseId).toBeNull()
  })

  it('selectProgram sets programId + programName without touching other fields', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.selectService('s1', 'Counseling')
    })
    act(() => result.current.selectProgram('prog-1', 'Parenting Bootcamp'))
    const s = result.current.state
    expect(s.programId).toBe('prog-1')
    expect(s.programName).toBe('Parenting Bootcamp')
    expect(s.clientId).toBe('c1')
    expect(s.serviceId).toBe('s1')
  })

  it('isComplete is true for GROUP track with clientId + programId only', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.selectProgram('prog-1', 'Parenting')
    })
    // Flip track to GROUP via selectTrack (which clears programId!) — so
    // set the programId after the track is set instead.
    act(() => result.current.reset())
    act(() => {
      // simulate the real wizard: selectTrack(GROUP) then selectProgram
      result.current.selectTrack('GROUP')
      result.current.selectClient('c1', 'Sara')
      result.current.selectProgram('prog-1', 'Parenting')
    })
    expect(result.current.state.track).toBe('GROUP')
    expect(result.current.isComplete).toBe(true)
  })

  it('isComplete is false for CLINICS track when only clientId + programId are set', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.selectProgram('prog-1', 'Parenting')
    })
    expect(result.current.state.track).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })

  it('applyPackageCreditTarget fills the credit triple AND sets packagePurchaseId', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => result.current.selectClient('c1', 'Sara'))
    act(() =>
      result.current.applyPackageCreditTarget(
        {
          departmentId: 'dep1', departmentName: 'قسم',
          categoryId: 'cat1', categoryName: 'عيادة', categoryBookingMode: 'SERVICES',
          serviceId: 's1', serviceName: 'خدمة',
          employeeId: 'e1', employeeName: 'موظف',
          durationOptionId: 'd1',
        },
        'pkg-7',
      ),
    )
    const s = result.current.state
    expect(s).toEqual(expect.objectContaining({
      packagePurchaseId: 'pkg-7',
      departmentId: 'dep1',
      serviceId: 's1',
      employeeId: 'e1',
      durationOptionId: 'd1',
      deliveryType: null,
      date: null,
      startTime: null,
    }))
  })

  it('selectClient clears programId/programName/packagePurchaseId but preserves track', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectTrack('GROUP')
      result.current.selectProgram('prog-1', 'Parenting')
    })
    expect(result.current.state.track).toBe('GROUP')
    expect(result.current.state.programId).toBe('prog-1')

    // Pre-seed a package purchase id so we can prove it gets cleared too.
    act(() =>
      result.current.applyPackageCreditTarget(
        {
          departmentId: 'dep1', departmentName: 'd',
          categoryId: 'cat1', categoryName: 'c', categoryBookingMode: 'SERVICES',
          serviceId: 's1', serviceName: 'svc',
          employeeId: 'e1', employeeName: 'emp',
          durationOptionId: 'd1',
        },
        'pkg-1',
      ),
    )
    expect(result.current.state.packagePurchaseId).toBe('pkg-1')

    act(() => result.current.selectClient('c2', 'Nora'))

    const s = result.current.state
    expect(s.track).toBe('GROUP') // preserved
    expect(s.clientId).toBe('c2')
    expect(s.clientName).toBe('Nora')
    expect(s.programId).toBeNull()
    expect(s.programName).toBeNull()
    expect(s.packagePurchaseId).toBeNull()
    // Downstream picks from the credit triple must also be cleared.
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
  })

  // W2-T5 — FLEXIBLE (rule-based) package credit path. The wizard
  // records the credit as a `creditFilter` that narrows the option
  // lists downstream, instead of jumping to a fixed target.

  it('initial state has creditFilter null (default = unrestricted)', () => {
    const { result } = renderHook(() => useBookingFormState())
    expect(result.current.state.creditFilter).toBeNull()
  })

  it('applyCreditFilter records the filter and the packagePurchaseId, leaving every target field null', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => result.current.selectClient('c1', 'Sara'))
    const filter = buildFlexibleFilter('pkg-9', [
      { dimension: 'SERVICE', mode: 'INCLUDE', targetIds: ['svc-1', 'svc-2'] },
    ])
    act(() => result.current.applyCreditFilter(filter))
    const s = result.current.state
    expect(s.creditFilter).toBe(filter)
    expect(s.packagePurchaseId).toBe('pkg-9')
    expect(s.departmentId).toBeNull()
    expect(s.categoryId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.durationOptionId).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it('applyCreditFilter clears every downstream field even when a target was previously filled', () => {
    const { result } = renderHook(() => useBookingFormState())
    // Fill a full target first.
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.selectDepartment('dep-1', 'Family')
      result.current.selectCategory('cat-1', 'Marriage', 'SERVICES')
      result.current.selectService('svc-1', 'Counseling')
      result.current.selectEmployee('emp-1', 'Ahmad')
      result.current.selectDeliveryType('IN_PERSON')
      result.current.selectDate('2026-06-01')
      result.current.selectTime('09:00')
    })
    expect(result.current.state.serviceId).toBe('svc-1')
    expect(result.current.state.employeeId).toBe('emp-1')

    // Now spend a flexible credit — every downstream pick must vanish.
    const filter = buildFlexibleFilter('pkg-flex', [
      { dimension: 'SERVICE', mode: 'INCLUDE', targetIds: ['svc-3'] },
    ])
    act(() => result.current.applyCreditFilter(filter))
    const s = result.current.state
    expect(s.creditFilter).toBe(filter)
    expect(s.packagePurchaseId).toBe('pkg-flex')
    expect(s.departmentId).toBeNull()
    expect(s.departmentName).toBeNull()
    expect(s.categoryId).toBeNull()
    expect(s.categoryName).toBeNull()
    expect(s.categoryBookingMode).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.serviceName).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.employeeName).toBeNull()
    expect(s.durationOptionId).toBeNull()
    expect(s.deliveryType).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it('clearCreditFilter nulls creditFilter and packagePurchaseId and clears downstream', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.applyCreditFilter(
        buildFlexibleFilter('pkg-clear', [
          { dimension: 'SERVICE', mode: 'INCLUDE', targetIds: ['svc-1'] },
        ]),
      )
    })
    expect(result.current.state.creditFilter).not.toBeNull()
    expect(result.current.state.packagePurchaseId).toBe('pkg-clear')

    act(() => result.current.clearCreditFilter())
    const s = result.current.state
    expect(s.creditFilter).toBeNull()
    expect(s.packagePurchaseId).toBeNull()
    expect(s.departmentId).toBeNull()
    expect(s.categoryId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.durationOptionId).toBeNull()
    expect(s.deliveryType).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    // clientId is preserved — only downstream fields are cleared.
    expect(s.clientId).toBe('c1')
  })

  it('selectTrack to a different track clears creditFilter back to null', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient('c1', 'Sara')
      result.current.applyCreditFilter(
        buildFlexibleFilter('pkg-flex', [
          { dimension: 'SERVICE', mode: 'INCLUDE', targetIds: ['svc-1'] },
        ]),
      )
    })
    expect(result.current.state.creditFilter).not.toBeNull()
    act(() => result.current.selectTrack('GROUP'))
    expect(result.current.state.creditFilter).toBeNull()
  })

  it('applyPackageCreditTarget (PINNED path) leaves creditFilter null and behaves as before', () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => result.current.selectClient('c1', 'Sara'))
    act(() =>
      result.current.applyPackageCreditTarget(
        {
          departmentId: 'dep1', departmentName: 'قسم',
          categoryId: 'cat1', categoryName: 'عيادة', categoryBookingMode: 'SERVICES',
          serviceId: 's1', serviceName: 'خدمة',
          employeeId: 'e1', employeeName: 'موظف',
          durationOptionId: 'd1',
        },
        'pkg-pinned-1',
      ),
    )
    const s = result.current.state
    expect(s.creditFilter).toBeNull()
    expect(s.packagePurchaseId).toBe('pkg-pinned-1')
    expect(s.departmentId).toBe('dep1')
    expect(s.categoryId).toBe('cat1')
    expect(s.serviceId).toBe('s1')
    expect(s.employeeId).toBe('e1')
    expect(s.durationOptionId).toBe('d1')
    expect(s.deliveryType).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  // W2B-T7 — closed the stale-restriction leak. When the operator
  // spends a FLEXIBLE credit (creditFilter set) and then backs up to
  // pick a PINNED credit, the jump-fill must clear creditFilter so the
  // wizard never applies a restriction that came from an abandoned
  // pick. Both `applyPackageCreditTarget` and `applyCreditTarget`
  // previously spread `prev` without nulling creditFilter; both now do.

  it('applyPackageCreditTarget after applyCreditFilter nulls creditFilter and fills the pinned target', () => {
    const { result } = renderHook(() => useBookingFormState())
    // Seed the stale filter by spending a flexible credit first.
    act(() => result.current.selectClient('c1', 'Sara'))
    const staleFilter = buildFlexibleFilter('pkg-stale', [
      { dimension: 'SERVICE', mode: 'INCLUDE', targetIds: ['svc-99'] },
    ])
    act(() => result.current.applyCreditFilter(staleFilter))
    expect(result.current.state.creditFilter).toBe(staleFilter)

    // Now pick a PINNED credit from a different package — the filter
    // must be cleared and the target fields populated from the new
    // CreditTarget.
    act(() =>
      result.current.applyPackageCreditTarget(
        {
          departmentId: 'dep-pinned', departmentName: 'قسم مثبت',
          categoryId: 'cat-pinned', categoryName: 'عيادة مثبتة', categoryBookingMode: 'SERVICES',
          serviceId: 's-pinned', serviceName: 'خدمة مثبتة',
          employeeId: 'e-pinned', employeeName: 'موظف مثبت',
          durationOptionId: 'd-pinned',
        },
        'pkg-pinned-7',
      ),
    )

    const s = result.current.state
    expect(s.creditFilter).toBeNull()
    expect(s.packagePurchaseId).toBe('pkg-pinned-7')
    expect(s.departmentId).toBe('dep-pinned')
    expect(s.departmentName).toBe('قسم مثبت')
    expect(s.categoryId).toBe('cat-pinned')
    expect(s.categoryName).toBe('عيادة مثبتة')
    expect(s.categoryBookingMode).toBe('SERVICES')
    expect(s.serviceId).toBe('s-pinned')
    expect(s.serviceName).toBe('خدمة مثبتة')
    expect(s.employeeId).toBe('e-pinned')
    expect(s.employeeName).toBe('موظف مثبت')
    expect(s.durationOptionId).toBe('d-pinned')
    expect(s.deliveryType).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it('applyCreditTarget after applyCreditFilter nulls creditFilter', () => {
    // Same leak-fix proof for the CLINICS-track sibling (`applyCreditTarget`,
    // which does not record `packagePurchaseId`).
    const { result } = renderHook(() => useBookingFormState())
    act(() => result.current.selectClient('c1', 'Sara'))
    const staleFilter = buildFlexibleFilter('pkg-stale-2', [
      { dimension: 'SERVICE', mode: 'EXCLUDE', targetIds: ['svc-1'] },
    ])
    act(() => result.current.applyCreditFilter(staleFilter))
    expect(result.current.state.creditFilter).toBe(staleFilter)

    act(() =>
      result.current.applyCreditTarget({
        departmentId: 'dep-clinics', departmentName: 'قسم عيادات',
        categoryId: 'cat-clinics', categoryName: 'عيادة', categoryBookingMode: 'DIRECT',
        serviceId: 's-clinics', serviceName: 'استشارة',
        employeeId: 'e-clinics', employeeName: 'موظف',
        durationOptionId: 'd-clinics',
      }),
    )

    const s = result.current.state
    expect(s.creditFilter).toBeNull()
    // packagePurchaseId is intentionally left as whatever the previous
    // pick left it — `applyCreditTarget` (CLINICS variant) never touches
    // it. The state-leak fix only concerns creditFilter.
    expect(s.packagePurchaseId).toBe('pkg-stale-2')
    expect(s.departmentId).toBe('dep-clinics')
    expect(s.serviceId).toBe('s-clinics')
    expect(s.employeeId).toBe('e-clinics')
    expect(s.durationOptionId).toBe('d-clinics')
    expect(s.deliveryType).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })
})
