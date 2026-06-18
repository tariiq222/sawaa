"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query"
import { fetchAvailability, setAvailability } from "@/lib/api/employees-schedule"
import { queryKeys } from "@/lib/query-keys"
import type { AvailabilitySlot } from "@/lib/types/employee"

export function useEmployeeSchedule(
  employeeId: string | null,
): UseQueryResult<AvailabilitySlot[]> {
  return useQuery<AvailabilitySlot[]>({
    queryKey: queryKeys.employees.schedule(employeeId ?? ""),
    queryFn: () => fetchAvailability(employeeId!),
    enabled: !!employeeId,
    staleTime: 60_000,
  })
}

export function useUpdateEmployeeSchedule(
  employeeId: string | null,
): UseMutationResult<void, Error, AvailabilitySlot[]> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (schedule: AvailabilitySlot[]) =>
      setAvailability(employeeId!, { schedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.schedule(employeeId ?? ""),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(employeeId ?? ""),
      })
    },
  })
}