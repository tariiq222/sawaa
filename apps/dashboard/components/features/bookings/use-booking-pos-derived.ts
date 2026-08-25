// W4-T13 — extracted from booking-pos.tsx on 2026-08-25. Owns the
// shell's derived values: `isServiceAutoSelected`, `summaries`,
// `canShowTypeDuration`, `canShowDatetime`, the `serviceTypes`
// query, `selectedServiceType`, `selectedDurationOption`,
// `servicePriceHalalas`, `selectedDurationMins`,
// `durationSummaryLabel`, `creditBadgeReady`. Pure move — bodies,
// comments, and `useMemo` dependency arrays are unchanged. The
// W3-T11 `(state.creditFilter == null || state.durationOptionId
// != null)` clause on `canShowDatetime` is preserved verbatim.

"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"

import type { Locale } from "@/lib/translations"
import type { SectionId } from "./pos-collapsible-section"
import type { BookingFormState } from "./use-booking-form-state"
import type { EmployeeServiceType } from "@/lib/types/employee"

interface UseBookingPosDerivedParams {
  state: BookingFormState
  t: (key: string) => string
  locale: Locale
}

export function useBookingPosDerived(params: UseBookingPosDerivedParams) {
  const { state, t, locale } = params

  const isServiceAutoSelected = useMemo(
    () => state.categoryBookingMode === "DIRECT" && !!state.serviceId,
    [state.categoryBookingMode, state.serviceId],
  )

  const deliveryTypeLabels: Record<string, string> = {
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
  }
  const summaries: Record<SectionId, string | null> = {
    client: state.clientName,
    track: state.track ? t(`bookings.pos.track.${state.track.toLowerCase()}`) : null,
    department: state.departmentName,
    // PACKAGES-track summary stays null — the section name lives inside
    // StepPackage; form state only carries `packagePurchaseId`. The
    // section's own isFilled gate (serviceId+employeeId) marks it filled.
    package: null,
    program: state.programName,
    category: state.categoryName,
    service: state.serviceName,
    employee: state.employeeName,
    typeDuration: state.deliveryType ? deliveryTypeLabels[state.deliveryType] ?? null : null,
    datetime: state.date
      ? state.date + (state.startTime ? ` · ${state.startTime}` : "")
      : null,
  }

  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  // W3-T11 — under an active FLEXIBLE-credit filter, an all-durations-
  // disallowed credit leaves `state.durationOptionId` null (the type/
  // duration step's `resolveDurationOptionId` already returns null in
  // that case). Gating `canShowDatetime` on `durationOptionId` here
  // closes the "operator clicks confirm and gets a generic
  // `submitError` toast" dead-end: the datetime step can never open,
  // so `state.date` and `state.startTime` stay null, so `isComplete`
  // (in `use-booking-form-state.ts`, which we do not own) stays false,
  // so the confirm button stays disabled.
  const canShowDatetime = Boolean(
    state.serviceId &&
      state.employeeId &&
      state.deliveryType &&
      (state.creditFilter == null || state.durationOptionId != null),
  )

  // Selected service price (halalas) for the summary.
  const { data: serviceTypes = [] } = useQuery<EmployeeServiceType[]>({
    queryKey: queryKeys.employees.serviceTypes(state.employeeId ?? "", state.serviceId ?? ""),
    queryFn: () => fetchEmployeeServiceTypes(state.employeeId!, state.serviceId!),
    enabled: !!state.employeeId && !!state.serviceId,
    staleTime: 0,
  })
  const selectedServiceType = useMemo(() => {
    if (!state.deliveryType || serviceTypes.length === 0) return undefined
    return serviceTypes.find(
      (st) => st.deliveryType.toLowerCase() === state.deliveryType?.toLowerCase() && st.isActive,
    )
  }, [serviceTypes, state.deliveryType])

  const selectedDurationOption = useMemo(() => {
    if (!selectedServiceType || !state.durationOptionId) return undefined
    return selectedServiceType.durationOptions?.find((o) => o.id === state.durationOptionId)
  }, [selectedServiceType, state.durationOptionId])

  const servicePriceHalalas = useMemo(() => {
    if (selectedDurationOption) return Number(selectedDurationOption.price)
    return selectedServiceType?.price != null ? Number(selectedServiceType.price) : null
  }, [selectedServiceType, selectedDurationOption])

  const selectedDurationMins = selectedDurationOption?.durationMinutes ?? null

  const durationSummaryLabel = selectedDurationOption
    ? (locale === "ar"
        ? selectedDurationOption.labelAr ?? selectedDurationOption.label
        : selectedDurationOption.label) ||
      `${selectedDurationOption.durationMinutes} ${t("bookings.wizard.step.typeDuration.minutes")}`
    : null

  const creditBadgeReady =
    !!state.clientId &&
    !!state.serviceId &&
    !!state.employeeId &&
    !!state.durationOptionId

  return {
    isServiceAutoSelected,
    summaries,
    canShowTypeDuration,
    canShowDatetime,
    serviceTypes,
    selectedServiceType,
    selectedDurationOption,
    servicePriceHalalas,
    selectedDurationMins,
    durationSummaryLabel,
    creditBadgeReady,
  }
}