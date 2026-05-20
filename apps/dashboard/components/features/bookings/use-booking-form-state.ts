import { useCallback, useState } from 'react'

export interface BookingFormState {
  clientId: string | null
  clientName: string | null
  serviceId: string | null
  serviceName: string | null
  employeeId: string | null
  employeeName: string | null
  deliveryType: 'in_person' | 'online' | null
  /** @deprecated Use deliveryType. Kept as a read-compatible alias during the refactor. */
  type: 'in_person' | 'online' | null
  durationOptionId: string | null
  durationLabel: string | null
  date: string | null      // ISO date YYYY-MM-DD
  startTime: string | null // HH:MM
  payAtClinic: boolean
  couponCode: string | null
}

const INITIAL_STATE: BookingFormState = {
  clientId: null,
  clientName: null,
  serviceId: null,
  serviceName: null,
  employeeId: null,
  employeeName: null,
  deliveryType: null,
  type: null,
  durationOptionId: null,
  durationLabel: null,
  date: null,
  startTime: null,
  payAtClinic: false,
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
      serviceId: null,
      serviceName: null,
      employeeId: null,
      employeeName: null,
      deliveryType: null,
      type: null,
      durationOptionId: null,
      durationLabel: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting a service resets employee/type/duration/datetime */
  const selectService = useCallback((serviceId: string, serviceName: string) => {
    setState((prev) => ({
      ...prev,
      serviceId,
      serviceName,
      employeeId: null,
      employeeName: null,
      deliveryType: null,
      type: null,
      durationOptionId: null,
      durationLabel: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting an employee resets type/duration/datetime */
  const selectEmployee = useCallback((employeeId: string, employeeName: string) => {
    setState((prev) => ({
      ...prev,
      employeeId,
      employeeName,
      deliveryType: null,
      type: null,
      durationOptionId: null,
      durationLabel: null,
      date: null,
      startTime: null,
    }))
  }, [])

  /** Selecting a delivery type resets duration/datetime */
  const selectDeliveryType = useCallback((deliveryType: 'in_person' | 'online') => {
    setState((prev) => ({
      ...prev,
      deliveryType,
      type: deliveryType,
      durationOptionId: null,
      durationLabel: null,
      date: null,
      startTime: null,
    }))
  }, [])

  const selectDuration = useCallback(
    (durationOptionId: string, durationLabel: string) => {
      setState((prev) => ({
        ...prev,
        durationOptionId,
        durationLabel,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  const skipDuration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      durationOptionId: null,
      durationLabel: null,
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
    selectService,
    selectEmployee,
    selectDeliveryType,
    /** @deprecated Use selectDeliveryType. */
    selectType: selectDeliveryType,
    selectDuration,
    skipDuration,
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
  }
}
