"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchPayments,
  fetchPaymentStats,
  refundPayment,
  verifyPayment,
} from "@/lib/api/payments"
import type { PaymentListQuery, PaymentStats } from "@/lib/types/payment"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

export type { PaymentStats }

export function usePaymentStats() {
  return useQuery({
    queryKey: queryKeys.payments.stats(),
    queryFn: fetchPaymentStats,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePaymentMutations() {
  const queryClient = useQueryClient()

  const refundMut = useMutation({
    mutationFn: ({ id, reason, amount }: { id: string; reason: string; amount?: number }) =>
      refundPayment(id, { reason, amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })
    },
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, action, transferRef }: { id: string; action: 'approve' | 'reject'; transferRef?: string }) =>
      verifyPayment(id, { action, transferRef }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })
    },
  })

  return { refundMut, verifyMut }
}

/* ─── List Hook ─── */

export function usePayments() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<PaymentStatus | "all">("all")
  const [method, setMethod] = useState<PaymentMethod | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query: PaymentListQuery = {
    page,
    perPage: 20,
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    method: method !== "all" ? method : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: () => fetchPayments(query),
  })

  const hasFilters = !!search || status !== "all" || method !== "all" || !!dateFrom || !!dateTo

  const resetFilters = useCallback(() => {
    setStatus("all")
    setMethod("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }, [])

  return {
    payments: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    status,
    setStatus: (s: PaymentStatus | "all") => { setStatus(s); setPage(1) },
    method,
    setMethod: (m: PaymentMethod | "all") => { setMethod(m); setPage(1) },
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasFilters,
    resetFilters,
    refetch,
  }
}
