// EXCEPTION: hook size limit (200) exceeded — 290 lines — 2026-06-25
// Phase 3 added `durationOptionId` to the booking form state plus a
// new `selectDurationOption` setter, and propagated the field through
// every reset path (client, department, category, service, employee).
// Phase 4 adds `CreditTarget` interface + `applyCreditTarget` setter for
// the package-credits panel wizard-jump flow.
// Once a follow-up refactor extracts reset paths into a helper this
// file will drop back under 200.

import { useCallback, useState } from 'react'

export type CategoryBookingMode = 'DIRECT' | 'SERVICES'

/**
 * Describes a fully-resolved target for a package credit: every field
 * needed to jump-fill the booking wizard from department down to
 * durationOption in one atomic state update.
 */
export interface CreditTarget {
  departmentId: string | null
  departmentName: string | null
  categoryId: string
  categoryName: string
  categoryBookingMode: CategoryBookingMode | null
  serviceId: string
  serviceName: string
  employeeId: string
  employeeName: string
  durationOptionId: string
}

export interface BookingFormState {
  clientId: string | null
  clientName: string | null
  departmentId: string | null
  departmentName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryBookingMode: CategoryBookingMode | null
  serviceId: string | null
  serviceName: string | null
  employeeId: string | null
  employeeName: string | null
  /**
   * Phase 3 — ServiceDurationOption id implied by the selected
   * (employee, service, deliveryType) triple. Set by StepTypeDuration
   * from the first/default duration option of the matching
   * EmployeeServiceType, so the auto-detect credit lookup and the
   * from-credit booking can use the exact triple the backend requires.
   */
  durationOptionId: string | null
  deliveryType: 'IN_PERSON' | 'ONLINE' | null
  /** @deprecated Use deliveryType. Kept as a read-compatible alias during the refactor. */
  type: 'IN_PERSON' | 'ONLINE' | null
  date: string | null      // ISO date YYYY-MM-DD
  startTime: string | null // HH:MM
  payAtClinic: boolean
  couponCode: string | null
}

const INITIAL_STATE: BookingFormState = {
  clientId: null,
  clientName: null,
  departmentId: null,
  departmentName: null,
  categoryId: null,
  categoryName: null,
  categoryBookingMode: null,
  serviceId: null,
  serviceName: null,
  employeeId: null,
  employeeName: null,
  durationOptionId: null,
  deliveryType: null,
  type: null,
  date: null,
  startTime: null,
  payAtClinic: true,
  couponCode: null,
}

export function useBookingFormState() {
  const [state, setState] = useState<BookingFormState>(INITIAL_STATE)

  const isComplete = Boolean(
    state.clientId &&
      state.serviceId &&
      state.employeeId &&
      state.deliveryType &&
      state.date &&
      state.startTime,
  )

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  /** Selecting a client resets all downstream selections */
  const selectClient = useCallback((clientId: string, clientName: string) => {
    setState((prev) => ({
      ...prev,
      clientId,
      clientName,
      departmentId: null,
      departmentName: null,
      categoryId: null,
      categoryName: null,
      categoryBookingMode: null,
      serviceId: null,
      serviceName: null,
      employeeId: null,
      employeeName: null,
      durationOptionId: null,
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting a department resets category and everything downstream */
  const selectDepartment = useCallback((departmentId: string, departmentName: string) => {
    setState((prev) => ({
      ...prev,
      departmentId,
      departmentName,
      categoryId: null,
      categoryName: null,
      categoryBookingMode: null,
      serviceId: null,
      serviceName: null,
      employeeId: null,
      employeeName: null,
      durationOptionId: null,
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /**
   * Selecting a category (clinic) resets service and everything downstream.
   * `bookingMode` controls whether the service step is skipped:
   *   - 'DIRECT'  → `autoService` is required; the hidden internal service is
   *                 pre-selected and the wizard jumps straight to the employee
   *                 step.
   *   - 'SERVICES' (or omitted for legacy clinics) → the user always picks a
   *                 service; `autoService` is ignored even if provided.
   */
  const selectCategory = useCallback(
    (
      categoryId: string,
      categoryName: string,
      bookingMode: CategoryBookingMode | null,
      autoService?: { serviceId: string; serviceName: string },
    ) => {
      const effectiveMode: CategoryBookingMode | null = bookingMode ?? null
      const shouldAutoSelect = effectiveMode === 'DIRECT' && !!autoService
      setState((prev) => ({
        ...prev,
        categoryId,
        categoryName,
        categoryBookingMode: effectiveMode,
        serviceId: shouldAutoSelect ? autoService!.serviceId : null,
        serviceName: shouldAutoSelect ? autoService!.serviceName : null,
        employeeId: null,
        employeeName: null,
        durationOptionId: null,
        deliveryType: null,
        type: null,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  /** Selecting a service resets employee/type/datetime */
  const selectService = useCallback((serviceId: string, serviceName: string) => {
    setState((prev) => ({
      ...prev,
      serviceId,
      serviceName,
      employeeId: null,
      employeeName: null,
      durationOptionId: null,
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting an employee resets type/datetime */
  const selectEmployee = useCallback((employeeId: string, employeeName: string) => {
    setState((prev) => ({
      ...prev,
      employeeId,
      employeeName,
      durationOptionId: null,
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting a delivery type resets datetime */
  const selectDeliveryType = useCallback((deliveryType: 'IN_PERSON' | 'ONLINE') => {
    setState((prev) => ({
      ...prev,
      deliveryType,
      type: deliveryType,
      date: null,
      startTime: null,
    }))
  }, [])

  /**
   * Phase 3 — set the resolved ServiceDurationOption id alongside the
   * selected deliveryType. StepTypeDuration resolves the duration from
   * the EmployeeServiceType's durationOptions (default → first) and
   * calls this so the auto-detect badge can query matching credits with
   * the full (client, service, employee, duration) triple.
   */
  const selectDurationOption = useCallback((durationOptionId: string | null) => {
    // Changing the duration changes both the available slots and the price,
    // so any previously-picked date/time is reset to force a fresh choice.
    setState((prev) =>
      prev.durationOptionId === durationOptionId
        ? prev
        : { ...prev, durationOptionId, date: null, startTime: null },
    )
  }, [])

  /** Selecting a date resets time */
  const selectDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, date, startTime: null }))
  }, [])

  const selectTime = useCallback((startTime: string) => {
    setState((prev) => ({ ...prev, startTime }))
  }, [])

  const setPayAtClinic = useCallback((payAtClinic: boolean) => {
    setState((prev) => ({ ...prev, payAtClinic }))
  }, [])

  const setCouponCode = useCallback((couponCode: string | null) => {
    setState((prev) => ({ ...prev, couponCode }))
  }, [])

  /**
   * Jump the wizard straight to a package credit's target: fills
   * department → category (+mode) → service → employee → durationOption in one
   * atomic update, leaving deliveryType/date/time for the user to finish.
   */
  const applyCreditTarget = useCallback((t: CreditTarget) => {
    setState((prev) => ({
      ...prev,
      departmentId: t.departmentId,
      departmentName: t.departmentName,
      categoryId: t.categoryId,
      categoryName: t.categoryName,
      categoryBookingMode: t.categoryBookingMode,
      serviceId: t.serviceId,
      serviceName: t.serviceName,
      employeeId: t.employeeId,
      employeeName: t.employeeName,
      durationOptionId: t.durationOptionId,
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  return {
    state,
    isComplete,
    reset,
    selectClient,
    selectDepartment,
    selectCategory,
    selectService,
    selectEmployee,
    selectDeliveryType,
    /** @deprecated Use selectDeliveryType. */
    selectType: selectDeliveryType,
    selectDurationOption,
    applyCreditTarget,
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
  }
}
