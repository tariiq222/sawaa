"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchSawaaAiModels, fetchSawaaAiSettings, saveSawaaAiSettings, testSawaaAiConnection } from "@/lib/api/sawaa-ai-settings"
import type { AiProviderSettingsInput, AiProviderTestInput } from "@/lib/api/sawaa-ai-settings"

export const SAWAA_AI_SETTINGS_KEY = ["sawaa-ai", "provider-config"] as const
export function useSawaaAiSettings() {
  const query = useQuery({ queryKey: SAWAA_AI_SETTINGS_KEY, queryFn: fetchSawaaAiSettings, staleTime: 60_000 })
  return { ...query, config: query.data, loading: query.isLoading }
}
export function useSawaaAiModels() {
  return useQuery({ queryKey: ["sawaa-ai", "models"], queryFn: fetchSawaaAiModels, staleTime: 5 * 60_000 })
}
export function useSaveSawaaAiSettings() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: AiProviderSettingsInput) => saveSawaaAiSettings(input), onSuccess: () => qc.invalidateQueries({ queryKey: SAWAA_AI_SETTINGS_KEY }) })
}
export function useTestSawaaAiConnection() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (input: AiProviderTestInput) => testSawaaAiConnection(input), onSuccess: () => qc.invalidateQueries({ queryKey: SAWAA_AI_SETTINGS_KEY }) })
}
