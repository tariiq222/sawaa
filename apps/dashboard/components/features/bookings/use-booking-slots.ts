import React from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchSlots, fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"
import { fetchEmployeeServices } from "@/lib/api/employees-schedule"
import { queryKeys } from "@/lib/query-keys"
import type { EmployeeDurationOption, EmployeeService } from "@/lib/types/employee"

interface UseBookingSlotsOptions {
  employeeId: string
  serviceId: string
  deliveryType?: string
  date: string
  durationOptionId: string
}

export function useCreateBookingSlots({
  employeeId,
  serviceId,
  deliveryType,
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
    if (!serviceTypes.length || !deliveryType) return []
    const pst = serviceTypes.find(
      (st) => st.deliveryType === deliveryType,
    )
    if (!pst || !pst.isActive) return []
    return pst.durationOptions ?? []
  }, [serviceTypes, deliveryType])

  const hasDurationOptions = durationOptions.length > 0

  const selectedDuration = React.useMemo((): number | undefined => {
    if (hasDurationOptions) {
      const opt = durationOptions.find((d) => d.id === durationOptionId)
      return opt?.durationMinutes
    }

    // Fallback: when no duration options, use service type duration or service duration
    const pst = serviceTypes.find((st) => st.deliveryType === deliveryType)
    if (pst?.isActive && pst?.duration != null) return pst.duration

    const es = employeeServices.find((s) => s.serviceId === serviceId)
    return es?.service?.duration
  }, [hasDurationOptions, durationOptions, durationOptionId, serviceTypes, deliveryType, employeeServices, serviceId])

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
