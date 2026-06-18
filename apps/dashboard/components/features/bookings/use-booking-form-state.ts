import { useCallback, useState } from 'react'

export type CategoryBookingMode = 'DIRECT' | 'SERVICES'

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
  deliveryType: 'in_person' | 'online' | null
  /** @deprecated Use deliveryType. Kept as a read-compatible alias during the refactor. */
  type: 'in_person' | 'online' | null
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
      deliveryType: null,
      type: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting a delivery type resets datetime */
  const selectDeliveryType = useCallback((deliveryType: 'in_person' | 'online') => {
    setState((prev) => ({
      ...prev,
      deliveryType,
      type: deliveryType,
      date: null,
      startTime: null,
    }))
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
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
  }
}
