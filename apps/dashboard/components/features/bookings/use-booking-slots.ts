import React from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchSlots, fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"
import { fetchEmployeeServices } from "@/lib/api/employees-schedule"
import { queryKeys } from "@/lib/query-keys"
import type { EmployeeDurationOption, EmployeeService } from "@/lib/types/employee"

interface UseBookingSlotsOptions {
  employeeId: string
  serviceId: string
  bookingType: string
  date: string
  durationOptionId: string
}

export function useCreateBookingSlots({
  employeeId,
  serviceId,
  bookingType,
  date,
  durationOptionId,
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

  const durationOptions = React.useMemo((): EmployeeDurationOption[] => {
    if (!serviceTypes.length || !bookingType) return []
    const pst = serviceTypes.find((st) => st.bookingType === bookingType)
    if (!pst || !pst.isActive) return []
    return pst.durationOptions ?? []
  }, [serviceTypes, bookingType])

  const hasDurationOptions = durationOptions.length > 0

  const selectedDuration = React.useMemo((): number | undefined => {
    if (!hasDurationOptions) return undefined
    const opt = durationOptions.find((d) => d.id === durationOptionId)
    return opt?.durationMinutes
  }, [hasDurationOptions, durationOptions, durationOptionId])

  const canFetchSlots = !!employeeId && !!date &&
    (!hasDurationOptions || !!selectedDuration)

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [...queryKeys.employees.slots(employeeId, date), selectedDuration],
    queryFn: () => fetchSlots(employeeId, date, selectedDuration),
    enabled: canFetchSlots,
  })

  return {
    employeeServices,
    employeeServicesLoading,
    durationOptions,
    hasDurationOptions,
    selectedDuration,
    canFetchSlots,
    serviceTypesLoading,
    canFetchServiceTypes,
    slots,
    slotsLoading,
  }
}
