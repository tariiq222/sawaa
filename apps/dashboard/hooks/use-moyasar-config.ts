"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchMoyasarConfig,
  testMoyasarConfig,
  upsertMoyasarConfig,
  type MoyasarConfig,
  type TestMoyasarConfigResult,
  type UpsertMoyasarConfigPayload,
} from "@/lib/api/moyasar-config"

const MOYASAR_CONFIG_KEY = ["moyasar", "config"] as const

export function useMoyasarConfig() {
  return useQuery<MoyasarConfig | null>({
    queryKey: MOYASAR_CONFIG_KEY,
    queryFn: fetchMoyasarConfig,
    staleTime: 60 * 1000,
  })
}

export function useUpsertMoyasarConfig() {
  const queryClient = useQueryClient()
  return useMutation<
    Pick<MoyasarConfig, "publishableKey" | "isLive" | "updatedAt">,
    Error,
    UpsertMoyasarConfigPayload
  >({
    mutationFn: upsertMoyasarConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOYASAR_CONFIG_KEY })
    },
  })
}

export function useTestMoyasarConfig() {
  const queryClient = useQueryClient()
  return useMutation<TestMoyasarConfigResult, Error>({
    mutationFn: testMoyasarConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOYASAR_CONFIG_KEY })
    },
  })
}
