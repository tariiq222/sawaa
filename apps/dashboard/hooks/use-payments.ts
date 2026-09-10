"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { invalidateMutationImpact } from "@/lib/query-invalidation"
import {
  fetchPayments,
  refundPayment,
  verifyPayment,
  recordPayment,
  applyInvoiceDiscount,
  ensureBookingInvoice,
  manualRefundPayment,
  fetchPaymentStats,
  collectBookingPayment,
} from "@/lib/api/payments"
import type { CollectBookingPaymentPayload } from "@/lib/api/payments"
import type { Payment, PaymentListQuery } from "@/lib/types/payment"
import type { PaginatedResponse } from "@/lib/types/common"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

type KnownPaymentContext = {
  invoiceId?: string
  bookingId?: string
  clientId?: string
  employeeId?: string
}

type PaymentMutationVariables = KnownPaymentContext & {
  id: string
}

function cachedPayment(queryClient: ReturnType<typeof useQueryClient>, paymentId: string) {
  const rows = queryClient.getQueriesData<PaginatedResponse<Payment>>({
    queryKey: queryKeys.payments.all,
  })
  return rows.flatMap(([, data]) => data?.items ?? []).find((item) => item.id === paymentId)
}

function invalidatePaymentResult(
  queryClient: ReturnType<typeof useQueryClient>,
  kind: "payment-settled" | "payment-refunded",
  payment: Payment,
  variables: KnownPaymentContext & { id?: string },
) {
  const cached = cachedPayment(queryClient, variables.id ?? payment.id)
  const invoiceId = variables.invoiceId ?? payment.invoiceId ?? cached?.invoiceId
  if (!invoiceId) {
    // A malformed/legacy response must never invent an invoice scope. Keep
    // the persisted mutation successful while refreshing the known payment
    // surfaces so the user can reopen the row and retry a read.
    return Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all, refetchType: "all" }),
      variables.id
        ? queryClient.invalidateQueries({ queryKey: queryKeys.payments.detail(variables.id), refetchType: "all" })
        : Promise.resolve(),
    ]).then(() => undefined)
  }
  return invalidateMutationImpact(queryClient, {
    kind,
    invoiceId,
    paymentId: variables.id ?? payment.id,
    bookingId: variables.bookingId ?? cached?.invoice?.bookingId,
    clientId: variables.clientId ?? cached?.invoice?.clientId,
    employeeId: variables.employeeId,
  })
}

export function usePaymentMutations() {
  const queryClient = useQueryClient()

  const refundMut = useMutation({
    mutationFn: ({ id, reason, amount }: PaymentMutationVariables & { reason: string; amount?: number }) =>
      refundPayment(id, { reason, amount }),
    onSuccess: (payment, variables) => invalidatePaymentResult(queryClient, "payment-refunded", payment, variables),
  })

  const verifyMut = useMutation({
    mutationFn: ({ id, action, transferRef }: PaymentMutationVariables & { action: 'approve' | 'reject'; transferRef?: string }) =>
      verifyPayment(id, { action, transferRef }),
    onSuccess: (payment, variables) => invalidatePaymentResult(queryClient, "payment-settled", payment, variables),
  })

  // Off-gateway (cash/bank-transfer) refund issued from the bookings list.
  const manualRefundMut = useMutation({
    mutationFn: ({ id, reason, amount }: PaymentMutationVariables & { reason: string; amount?: number }) =>
      manualRefundPayment(id, { reason, amount }),
    onSuccess: (payment, variables) => invalidatePaymentResult(queryClient, "payment-refunded", payment, variables),
  })

  return { refundMut, verifyMut, manualRefundMut }
}

/* ─── Manual payment recording (from the bookings list "unpaid" cell) ─── */

export function useRecordPaymentMutations() {
  const queryClient = useQueryClient()

  const applyDiscountMut = useMutation({
    mutationFn: ({
      invoiceId,
      discountAmt,
      discountReasonId,
    }: { invoiceId: string; discountAmt: number; discountReasonId?: string }) =>
      applyInvoiceDiscount(invoiceId, { discountAmt, discountReasonId }),
    onSuccess: () => Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all, refetchType: "all" }),
    ]).then(() => undefined),
  })

  const recordMut = useMutation({
    mutationFn: ({
      invoiceId,
      amount,
      method,
    }: { invoiceId: string; amount: number; method: "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY" }) =>
      recordPayment({ invoiceId, amount, method }),
    onSuccess: (payment, variables) => invalidatePaymentResult(queryClient, "payment-settled", payment, variables),
  })

  // Lazily materialise a DRAFT invoice for a booking that has none (pay-at-clinic)
  // so reception can record an upfront payment against it. The booking
  // list will stale until refetched otherwise.
  const ensureInvoiceMut = useMutation({
    mutationFn: (bookingId: string) => ensureBookingInvoice(bookingId),
    onSuccess: () => Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all, refetchType: "all" }),
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all, refetchType: "all" }),
    ]).then(() => undefined),
  })

  // Unified booking collection — single round trip that ensures the booking
  // has an invoice, applies any discount, and records the payment. Staff
  // methods are statistical labels; the backend never calls Moyasar here.
  const collectMut = useMutation({
    mutationFn: ({
      bookingId,
      ...payload
    }: { bookingId: string } & CollectBookingPaymentPayload) =>
      collectBookingPayment(bookingId, payload),
    onSuccess: (result) => invalidateMutationImpact(queryClient, {
      kind: "payment-settled",
      invoiceId: result.invoice.id,
      paymentId: result.payment?.id,
      bookingId: result.bookingId,
    }),
  })

  return { applyDiscountMut, recordMut, ensureInvoiceMut, collectMut }
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
    limit: 20,
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    method: method !== "all" ? method : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: () => fetchPayments(query),
    staleTime: 30_000,
    refetchOnMount: false,
    retry: 1,
  })

  const statsQuery = useQuery({
    queryKey: queryKeys.payments.stats(),
    queryFn: fetchPaymentStats,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  })

  const hasFilters = !!search || status !== "all" || method !== "all" || !!dateFrom || !!dateTo

  const resetFilters = useCallback(() => {
    setSearch("")
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
    historicalStats: statsQuery.data?.historical ?? null,
    statsLoading: statsQuery.isLoading,
  }
}
