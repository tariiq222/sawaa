"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchDurationOptions,
  setDurationOptions,
  fetchServiceBookingTypes,
  setServiceBookingTypes,
} from "@/lib/api/services"
import type {
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
} from "@/lib/types/service-payloads"

export function useDurationOptions(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.durationOptions(serviceId ?? ""),
    queryFn: () => fetchDurationOptions(serviceId!),
    enabled: !!serviceId,
  })
}

export function useDurationOptionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetDurationOptionsPayload }) =>
      setDurationOptions(serviceId, payload),
    onSuccess: (_data, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.durationOptions(serviceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
    },
  })
}

export function useServiceBookingTypes(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.bookingTypes(serviceId!),
    queryFn: () => fetchServiceBookingTypes(serviceId!),
    enabled: !!serviceId,
  })
}

export function useServiceBookingTypesMutation(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetServiceBookingTypesPayload) =>
      setServiceBookingTypes(serviceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.bookingTypes(serviceId) })
    },
  })
}