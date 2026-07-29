"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  assignService,
  updateEmployeeService,
  removeEmployeeService,
  setEmployeeServiceOptions,
  setEmployeeCustomPricing,
  setEmployeeDeliveryTypes,
  setEmployeeDurations,
  setEmployeePricingMode,
  type SetCustomPricingPayload,
  type SetPractitionerDurationsPayload,
} from "@/lib/api/employees"
import type {
  AssignServicePayload,
  UpdateServicePayload,
  SetEmployeeServiceOptionsPayload,
} from "@/lib/types/employee"

export function useEmployeeServiceMutations(employeeId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.employees.services(employeeId),
    })
  const invalidateServiceList = (serviceId: string) =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.services.employees(serviceId),
    })

  const assignMut = useMutation({
    mutationFn: (payload: AssignServicePayload) =>
      assignService(employeeId, payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string
      payload: UpdateServicePayload
    }) => updateEmployeeService(employeeId, serviceId, payload),
    onSuccess: (_data, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
    },
  })

  const optionsMut = useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: string
      payload: SetEmployeeServiceOptionsPayload
    }) => setEmployeeServiceOptions(employeeId, serviceId, payload),
    onSuccess: (_data, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.serviceTypes(employeeId, vars.serviceId),
      })
    },
  })

  const removeMut = useMutation({
    mutationFn: (serviceId: string) =>
      removeEmployeeService(employeeId, serviceId),
    onSuccess: (_data, serviceId) => {
      invalidate()
      invalidateServiceList(serviceId)
    },
  })

  const customPricingMut = useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetCustomPricingPayload }) =>
      setEmployeeCustomPricing(employeeId, serviceId, payload),
    onSuccess: (_d, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.serviceTypes(employeeId, vars.serviceId),
      })
    },
  })

  const durationsMut = useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetPractitionerDurationsPayload }) =>
      setEmployeeDurations(employeeId, serviceId, payload),
    onSuccess: (_d, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.serviceTypes(employeeId, vars.serviceId),
      })
    },
  })

  const pricingModeMut = useMutation({
    mutationFn: ({ serviceId, isCustom }: { serviceId: string; isCustom: boolean }) =>
      setEmployeePricingMode(employeeId, serviceId, isCustom),
    onSuccess: (_d, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.serviceTypes(employeeId, vars.serviceId),
      })
    },
  })

  const deliveryTypesMut = useMutation({
    mutationFn: ({ serviceId, disabledDeliveryTypes }: { serviceId: string; disabledDeliveryTypes: string[] }) =>
      setEmployeeDeliveryTypes(employeeId, serviceId, disabledDeliveryTypes),
    onSuccess: (_d, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
    },
  })

  return {
    assignMut,
    updateMut,
    optionsMut,
    removeMut,
    customPricingMut,
    durationsMut,
    deliveryTypesMut,
    pricingModeMut,
  }
}