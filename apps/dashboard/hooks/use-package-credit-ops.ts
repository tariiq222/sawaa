"use client"

/**
 * Package Credit Operations Hooks — Sawaa Dashboard
 *
 * TanStack Query bindings for the Phase 5 session-packages operator
 * mutations:
 *   - `useTransferCredit` → POST /dashboard/bookings/credits/:id/transfer
 *   - `useRefundPackagePurchase` → POST /dashboard/finance/package-purchases/:id/refund
 *
 * Mirrors the conventions of `hooks/use-package-purchases.ts` and
 * `hooks/use-credit-bookings.ts` — TanStack Query only, query keys
 * centralised in `lib/query-keys.ts`.
 *
 * Both mutations invalidate the affected caches so the balances panel
 * + the per-client purchases view refresh on next mount:
 *   - transfer: package-purchases (the credit's employeeId changed) +
 *               bookings (none today, but defensive for the future).
 *   - refund:   package-purchases (purchase REFUNDED + credits voided)
 *               + payments + invoices (the financial refund is recorded
 *               via the existing finance RefundRequest table).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import {
  refundPackagePurchase,
  transferCredit,
} from "@/lib/api/package-credit-ops"
import type {
  RefundPackagePurchasePayload,
  RefundPackagePurchaseResult,
  TransferCreditPayload,
  TransferCreditResult,
} from "@/lib/types/credit-ops"

/* ─── Transfer credit mutation ─── */

export function useTransferCredit() {
  const queryClient = useQueryClient()

  return useMutation<
    TransferCreditResult,
    Error,
    { creditId: string; payload: TransferCreditPayload }
  >({
    mutationFn: ({ creditId, payload }) => transferCredit(creditId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.packagePurchases.all,
        refetchType: "all",
      })
    },
  })
}

/* ─── Refund package purchase mutation ─── */

export function useRefundPackagePurchase() {
  const queryClient = useQueryClient()

  return useMutation<
    RefundPackagePurchaseResult,
    Error,
    { purchaseId: string; payload: RefundPackagePurchasePayload }
  >({
    mutationFn: ({ purchaseId, payload }) =>
      refundPackagePurchase(purchaseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.packagePurchases.all,
        refetchType: "all",
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all,
        refetchType: "all",
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoices.all,
        refetchType: "all",
      })
    },
  })
}
