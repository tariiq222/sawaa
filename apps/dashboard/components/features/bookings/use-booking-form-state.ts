// EXCEPTION: hook size limit (200) and absolute file size limit (350)
// exceeded — 2026-08-23 — Phase 6 added BookingTrack +
// programId/programName/packagePurchaseId + selectTrack,
// selectProgram, applyPackageCreditTarget for the three wizard
// branches. isComplete is track-aware: GROUP needs clientId+programId;
// everything else keeps the original six-field condition.
//
// W2-T2 update — 2026-08-23 — added collectionMethod +
// setCollectionMethod + a new doc comment block (so this file is now
// 379 lines, still over the 350-line absolute limit); the explicit
// collection-timing radiogroup + shared PaymentMethodPicker in
// booking-summary.tsx needs a manual-method state field. The default
// remains payAtClinic=true (reception default) so existing reception
// bookings are invoiced exactly as today; the guard that disables
// Pay-at-Clinic (and forces payAtClinic=false) when the org setting
// paymentAtClinicEnabled is false lives in booking-pos.tsx, not in
// the hook, so the hook stays policy-free.

import { useCallback, useState } from 'react'

export type CategoryBookingMode = 'DIRECT' | 'SERVICES'

/** Booking wizard track. Structurally identical to `WizardTrack` in
 *  `wizard-steps/step-track.tsx`; declared independently so the hook
 *  stays unit-testable without the UI. */
export type BookingTrack = "CLINICS" | "GROUP" | "PACKAGES"

/** Fully-resolved target for a package credit: every field needed to
 *  jump-fill the booking wizard from department down to durationOption
 *  in one atomic state update. */
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
  /** Phase 6 — which wizard branch the operator chose at step 2. */
  track: BookingTrack | null
  departmentId: string | null
  departmentName: string | null
  categoryId: string | null
  categoryName: string | null
  categoryBookingMode: CategoryBookingMode | null
  serviceId: string | null
  serviceName: string | null
  employeeId: string | null
  employeeName: string | null
  /** Phase 3 — ServiceDurationOption id implied by the selected
   *  (employee, service, deliveryType) triple. */
  durationOptionId: string | null
  deliveryType: 'IN_PERSON' | 'ONLINE' | null
  /** @deprecated Use deliveryType. */
  type: 'IN_PERSON' | 'ONLINE' | null
  date: string | null      // ISO date YYYY-MM-DD
  startTime: string | null // HH:MM
  /** Phase 6 — GROUP track program the client was enrolled into. */
  programId: string | null
  programName: string | null
  /** Phase 6 — PACKAGES track purchase the first session consumes. */
  packagePurchaseId: string | null
  payAtClinic: boolean
  /** W2-T2 — collection method selected when `payAtClinic === false`
   *  (تحصيل الآن). Default "CASH" so the shared PaymentMethodPicker
   *  has a stable seed before settings load. The submitted value is
   *  `resolveActiveMethod(paymentSettings, collectionMethod)` and NEVER
   *  the raw state, so the chip and the recorded payment cannot
   *  diverge. */
  collectionMethod: "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"
  couponCode: string | null
}

const INITIAL_STATE: BookingFormState = {
  clientId: null,
  clientName: null,
  track: null,
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
  programId: null,
  programName: null,
  packagePurchaseId: null,
  payAtClinic: true,
  collectionMethod: "CASH",
  couponCode: null,
}

/** Partial state covering every field "downstream" of the client
 *  picker. `selectTrack` uses this to clear department-and-below
 *  because switching tracks invalidates whatever the operator had
 *  picked inside the previous branch. */
type DownstreamReset = Partial<BookingFormState>

function downstreamReset(overrides: DownstreamReset = {}): DownstreamReset {
  return {
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
    programId: null,
    programName: null,
    packagePurchaseId: null,
    ...overrides,
  }
}

export function useBookingFormState() {
  const [state, setState] = useState<BookingFormState>(INITIAL_STATE)

  // Phase 6 — GROUP track is "complete" once clientId + programId are
  // set (enrollment creates the booking server-side). Every other
  // track keeps the original six-field condition.
  const isComplete = state.track === 'GROUP'
    ? Boolean(state.clientId && state.programId)
    : Boolean(
        state.clientId &&
          state.serviceId &&
          state.employeeId &&
          state.deliveryType &&
          state.date &&
          state.startTime,
      )

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  /** Selecting a client resets every downstream selection EXCEPT `track` —
   *  operator may keep browsing the same track for a different client.
   *  Program/package fields still clear because switching clients
   *  invalidates any prior enrollment/credit pick. */
  const selectClient = useCallback((clientId: string, clientName: string) => {
    setState((prev) => ({ ...prev, clientId, clientName, ...downstreamReset() }))
  }, [])

  /** Switching tracks invalidates whatever the operator had picked in the
   *  previous branch (department/credit/program/purchase). Client identity
   *  is preserved so the operator doesn't re-pick the same client. */
  const selectTrack = useCallback((track: BookingTrack) => {
    setState((prev) => ({ ...prev, track, ...downstreamReset() }))
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

  /** Selecting a category (clinic) resets service and everything downstream.
   *  bookingMode='DIRECT' auto-selects the category's hidden internal service
   *  and skips the service step; 'SERVICES' (or null) always shows it. */
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

  /** Phase 3 — set the resolved ServiceDurationOption id; clears
   *  date/time since changing duration changes slots + price. */
  const selectDurationOption = useCallback((durationOptionId: string | null) => {
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

  /** Phase 6 — GROUP track only. Sets programId + localised name once
   *  backend enrollment succeeds. Flips isComplete to true so the
   *  shell can close without showing a "confirm" affordance. */
  const selectProgram = useCallback((programId: string, programName: string) => {
    setState((prev) => ({ ...prev, programId, programName }))
  }, [])

  const setPayAtClinic = useCallback((payAtClinic: boolean) => {
    setState((prev) => ({ ...prev, payAtClinic }))
  }, [])

  /** W2-T2 — update the manual collection method. The container still
   *  pipes the value through `resolveActiveMethod` before it reaches
   *  the API, so this state is the operator's selection, not the
   *  payload. */
  const setCollectionMethod = useCallback(
    (collectionMethod: BookingFormState["collectionMethod"]) => {
      setState((prev) => ({ ...prev, collectionMethod }))
    },
    [],
  )

  const setCouponCode = useCallback((couponCode: string | null) => {
    setState((prev) => ({ ...prev, couponCode }))
  }, [])

  /** Jump the wizard straight to a package credit's target: fills
   *  department → category (+mode) → service → employee → durationOption in
   *  one atomic update, leaving deliveryType/date/time for the user. */
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

  /** Phase 6 — PACKAGES track variant of `applyCreditTarget`. Identical
   *  jump-fill PLUS records `packagePurchaseId` so the submit path can
   *  prove which package purchase the first session consumed. */
  const applyPackageCreditTarget = useCallback(
    (t: CreditTarget, packagePurchaseId: string) => {
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
        packagePurchaseId,
        deliveryType: null,
        type: null,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  return {
    state,
    isComplete,
    reset,
    selectClient,
    selectTrack,
    selectDepartment,
    selectCategory,
    selectService,
    selectEmployee,
    selectDeliveryType,
    /** @deprecated Use selectDeliveryType. */
    selectType: selectDeliveryType,
    selectDurationOption,
    selectDate,
    selectTime,
    selectProgram,
    setPayAtClinic,
    setCollectionMethod,
    setCouponCode,
    applyCreditTarget,
    applyPackageCreditTarget,
  }
}