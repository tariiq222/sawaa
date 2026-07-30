"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchServiceEmployees } from "@/lib/api/services"
import { assignService } from "@/lib/api/employees"
import type { AssignServicePayload } from "@/lib/types/employee"

export function useServiceEmployees(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAssignEmployeesToService(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (employeeIds: string[]) =>
      Promise.all(
        employeeIds.map((employeeId) =>
          assignService(employeeId, {
            serviceId,
          } satisfies AssignServicePayload),
        ),
      ),
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.employees(serviceId),
      })
    },
  })
}