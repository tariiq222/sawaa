"use client"

// SaaS-02g-sms — dashboard SMS config queries + mutations.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  fetchSmsConfig,
  fetchSmsDeliveries,
  sendTestSms,
  upsertSmsConfig,
} from "@/lib/api/sms"
import type {
  SmsConfigView,
  SmsDeliveryRow,
  TestSmsResult,
  UpsertSmsConfigInput,
} from "@/lib/types/sms"

const SMS_CONFIG_KEY = ["sms", "config"] as const
const SMS_DELIVERIES_KEY = ["sms", "deliveries"] as const

export function useSmsConfig() {
  const { data, isLoading, error } = useQuery<SmsConfigView>({
    queryKey: SMS_CONFIG_KEY,
    queryFn: fetchSmsConfig,
    staleTime: 60 * 1000,
  })
  return {
    config: data,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}

export function useSmsDeliveries() {
  const { data, isLoading, error, refetch } = useQuery<{ items: SmsDeliveryRow[] }>({
    queryKey: SMS_DELIVERIES_KEY,
    queryFn: fetchSmsDeliveries,
    staleTime: 30 * 1000,
  })
  return {
    deliveries: data?.items ?? [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    refetch,
  }
}

export function useUpsertSmsConfig() {
  const qc = useQueryClient()
  return useMutation<SmsConfigView, Error, UpsertSmsConfigInput>({
    mutationFn: upsertSmsConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SMS_CONFIG_KEY })
    },
  })
}

export function useTestSms() {
  const qc = useQueryClient()
  return useMutation<TestSmsResult, Error, string>({
    mutationFn: sendTestSms,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SMS_CONFIG_KEY })
      qc.invalidateQueries({ queryKey: SMS_DELIVERIES_KEY })
    },
  })
}
