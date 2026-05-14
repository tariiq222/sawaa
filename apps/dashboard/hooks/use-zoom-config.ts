"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchZoomConfig,
  retryBookingZoomMeeting,
  testZoomConfig,
  upsertZoomConfig,
} from "@/lib/api/zoom"
import type {
  TestZoomResult,
  UpsertZoomConfigInput,
  ZoomConfigView,
} from "@/lib/types/zoom"

const ZOOM_CONFIG_KEY = ["zoom", "config"] as const

export function useZoomConfig() {
  const { data, isLoading, error } = useQuery<ZoomConfigView>({
    queryKey: ZOOM_CONFIG_KEY,
    queryFn: fetchZoomConfig,
    staleTime: 60 * 1000,
  })
  return {
    config: data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}

export function useUpsertZoomConfig() {
  const qc = useQueryClient()
  return useMutation<ZoomConfigView, Error, UpsertZoomConfigInput>({
    mutationFn: upsertZoomConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZOOM_CONFIG_KEY })
    },
  })
}

export function useTestZoomConfig() {
  return useMutation<TestZoomResult, Error, UpsertZoomConfigInput>({
    mutationFn: testZoomConfig,
  })
}

export function useRetryBookingZoom() {
  const qc = useQueryClient()
  return useMutation<{ ok: true }, Error, string>({
    mutationFn: retryBookingZoomMeeting,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] })
    },
  })
}
