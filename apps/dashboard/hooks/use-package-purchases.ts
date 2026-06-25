"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  createPackagePurchase,
  fetchClientPackagePurchases,
} from "@/lib/api/package-purchases"
import type {
  ClientPackagePurchasesQuery,
  CreatePackagePurchasePayload,
  PackagePurchase,
} from "@/lib/types/package-purchase"

/* ─── Client balances (purchases + credit buckets) ─── */

/**
 * Fetch a client's package purchases with credit buckets. Used by the
 * balances panel on the client detail page. Same query key as
 * `queryKeys.clients.bookings` etc. so callers can invalidate via
 * `queryKeys.packagePurchases.all` to refetch every client's balances at
 * once.
 */
export function useClientPackagePurchases(
  clientId: string | null,
  query: ClientPackagePurchasesQuery = {},
) {
  return useQuery<PackagePurchase[]>({
    queryKey: queryKeys.packagePurchases.byClient(clientId ?? "", query),
    queryFn: () => fetchClientPackagePurchases(clientId!, query),
    enabled: !!clientId,
    staleTime: 60_000,
  })
}

/* ─── Sell mutation ─── */

/**
 * Sell a SessionPackage to a client at the desk (manual payment). On
 * success invalidates:
 *   - the catalog (catalog price doesn't change but finalPrice/compute
 *     may be re-read elsewhere),
 *   - every client's package-purchases (so the balances panel refreshes),
 *   - invoices + payments lists (the manual payment + full-amount invoice
 *     appear there).
 */
export function useSellPackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreatePackagePurchasePayload) =>
      createPackagePurchase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.packagePurchases.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}
