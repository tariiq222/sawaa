import React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  fetchAvailableDays,
  fetchEmployeeServiceTypes,
  fetchEmployeeServices,
  fetchSlots,
} from "@/lib/api/employees-schedule"
import { queryKeys } from "@/lib/query-keys"
import type { EmployeeService } from "@/lib/types/employee"
import { utcTimeToRiyadhHHMM } from "@/lib/utils"

interface UseBookingSlotsOptions {
  employeeId: string
  serviceId: string
  deliveryType?: string
  date: string
}

export function useCreateBookingSlots({
  employeeId,
  serviceId,
  deliveryType,
  date,
}: UseBookingSlotsOptions) {
  // Fetch services that belong to this employee
  const { data: employeeServices = [], isLoading: employeeServicesLoading } = useQuery<EmployeeService[]>({
    queryKey: queryKeys.employees.services(employeeId),
    queryFn: () => fetchEmployeeServices(employeeId),
    enabled: !!employeeId,
  })

  const canFetchServiceTypes = !!employeeId && !!serviceId

  const { data: serviceTypes = [], isLoading: serviceTypesLoading } = useQuery({
    queryKey: queryKeys.employees.serviceTypes(employeeId, serviceId),
    queryFn: () => fetchEmployeeServiceTypes(employeeId, serviceId),
    enabled: canFetchServiceTypes,
  })

  const selectedDuration = React.useMemo((): number | undefined => {
    // Use service type duration directly from the selected delivery type
    const pst = serviceTypes.find(
      (st) => st.deliveryType.toLowerCase() === (deliveryType ?? "").toLowerCase()
    )
    if (pst?.isActive && pst?.duration != null) return pst.duration

    const es = employeeServices.find((s) => s.serviceId === serviceId)
    return es?.service?.duration
  }, [serviceTypes, deliveryType, employeeServices, serviceId])

  const canFetchSlots = !!employeeId && !!date && !!selectedDuration

  const { data: rawSlots = [], isLoading: slotsLoading, isError: slotsError } = useQuery({
    queryKey: [...queryKeys.employees.slots(employeeId, date), selectedDuration, serviceId, deliveryType],
    queryFn: () =>
      fetchSlots(employeeId, date, selectedDuration, {
        serviceId,
        deliveryType,
      }),
    enabled: canFetchSlots,
  })

  // Backend returns slot times in UTC; convert to Asia/Riyadh wall-clock so
  // the UI displays times consistent with the rest of the dashboard.
  const slots = React.useMemo(
    () =>
      rawSlots.map((s) => ({
        startTime: utcTimeToRiyadhHHMM(date, s.startTime),
        endTime: utcTimeToRiyadhHHMM(date, s.endTime),
      })),
    [rawSlots, date],
  )

  return {
    employeeServices,
    employeeServicesLoading,
    selectedDuration,
    canFetchSlots,
    serviceTypesLoading,
    canFetchServiceTypes,
    slots,
    slotsLoading,
    slotsError,
  }
}

interface UseAvailableDaysOptions {
  employeeId: string
  serviceId: string
  deliveryType?: string
  startDate: string
  duration?: number
  days?: number
}

/**
 * Returns the subset of dates (within `days` of `startDate`) that have at
 * least one bookable slot — used by the wizard to disable empty day chips.
 */
export function useAvailableDays({
  employeeId,
  serviceId,
  deliveryType,
  startDate,
  duration,
  days = 30,
}: UseAvailableDaysOptions) {
  const enabled = !!employeeId && !!serviceId && !!deliveryType && !!startDate && !!duration
  const { data = [], isLoading, isError: daysError } = useQuery({
    queryKey: ["available-days", employeeId, serviceId, deliveryType, startDate, days, duration],
    queryFn: () =>
      fetchAvailableDays(employeeId, startDate, {
        days,
        duration,
        serviceId,
        deliveryType,
      }),
    enabled,
    staleTime: 60 * 1000,
  })
  const set = React.useMemo(() => new Set(data), [data])
  return { availableDates: set, loading: isLoading, enabled, daysError }
}
