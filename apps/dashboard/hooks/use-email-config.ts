"use client"

// email-provider — dashboard email config queries + mutations.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchEmailConfig,
  sendTestEmail,
  upsertEmailConfig,
} from "@/lib/api/email-config"
import type {
  EmailConfigView,
  TestEmailResult,
  UpsertEmailConfigInput,
} from "@/lib/types/email-config"

const EMAIL_CONFIG_KEY = ["email", "config"] as const

export function useEmailConfig() {
  const { data, isLoading, error } = useQuery<EmailConfigView>({
    queryKey: EMAIL_CONFIG_KEY,
    queryFn: fetchEmailConfig,
    staleTime: 60 * 1000,
  })
  return {
    config: data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}

export function useUpsertEmailConfig() {
  const qc = useQueryClient()
  return useMutation<EmailConfigView, Error, UpsertEmailConfigInput>({
    mutationFn: upsertEmailConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMAIL_CONFIG_KEY })
    },
  })
}

export function useTestEmail() {
  const qc = useQueryClient()
  return useMutation<TestEmailResult, Error, string>({
    mutationFn: sendTestEmail,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EMAIL_CONFIG_KEY })
    },
  })
}
