"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createEmployee,
  onboardEmployee,
  updateEmployee,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updateEmployeeService,
  setEmployeeServiceOptions,
  removeEmployeeService,
  createEmployeeAccount,
  updateEmployeeAccount,
  setEmployeeCustomPricing,
  setEmployeeDurations,
  setEmployeeDeliveryTypes,
  setEmployeePricingMode,
} from "@/lib/api/employees"
import type {
  EmployeeAccountRole,
  SetCustomPricingPayload,
  SetPractitionerDurationsPayload,
} from "@/lib/api/employees"
import type {
  AssignServicePayload,
  SetEmployeeServiceOptionsPayload,
  UpdateServicePayload,
  OnboardEmployeePayload,
} from "@/lib/types/employee"

// EmployeeAccountRole re-exported for convenience
export type { EmployeeAccountRole }

/* ─── Core CRUD Mutations ─── */

export function useEmployeeMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.employees.all,
      refetchType: "all",
    })

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: invalidate,
  })

  const onboardMutation = useMutation({
    mutationFn: (payload: OnboardEmployeePayload) => onboardEmployee(payload),
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateEmployee>[1]) =>
      updateEmployee(id, payload),
    onSuccess: invalidate,
  })

  return { createMutation, onboardMutation, updateMutation }
}

/* ─── Availability Mutation ─── */

export function useSetAvailability() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof setAvailability>[1]) =>
      setAvailability(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.availability(vars.id),
      })
    },
  })
}

/* ─── Breaks Mutation ─── */

export function useSetBreaks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof setBreaks>[1]) =>
      setBreaks(id, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.breaks(vars.id),
      })
    },
  })
}

/* ─── Vacation Mutations ─── */

export function useVacationMutations(employeeId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.employees.vacations(employeeId),
    })

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof createVacation>[1]) =>
      createVacation(employeeId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (vacationId: string) =>
      deleteVacation(employeeId, vacationId),
    onSuccess: invalidate,
  })

  return { createMut, deleteMut }
}

/* ─── Employee Service Mutations ─── */

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
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.practitionerDurations(employeeId, vars.serviceId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.bookingTypes(vars.serviceId),
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

  const pricingModeMut = useMutation({
    mutationFn: ({ serviceId, useCustomPricing }: { serviceId: string; useCustomPricing: boolean }) =>
      setEmployeePricingMode(employeeId, serviceId, useCustomPricing),
    onSuccess: (_d, vars) => {
      invalidate()
      invalidateServiceList(vars.serviceId)
    },
  })

  return { assignMut, updateMut, optionsMut, removeMut, customPricingMut, durationsMut, deliveryTypesMut, pricingModeMut }
}

/* ─── Employee Account Mutations ─── */

export function useEmployeeAccountMutations(employeeId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.employees.account(employeeId),
    })
    queryClient.invalidateQueries({
      queryKey: queryKeys.employees.detail(employeeId),
    })
  }

  const createMut = useMutation({
    mutationFn: (payload: { role: EmployeeAccountRole; password?: string }) =>
      createEmployeeAccount(employeeId, payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: (payload: { role?: EmployeeAccountRole; isActive?: boolean }) =>
      updateEmployeeAccount(employeeId, payload),
    onSuccess: invalidate,
  })

  return { createMut, updateMut }
}
