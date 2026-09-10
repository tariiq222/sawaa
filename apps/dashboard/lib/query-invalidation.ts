import type { QueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"

export type MutationImpact =
  | {
      kind: "payment-settled" | "payment-refunded"
      invoiceId: string
      paymentId?: string
      bookingId?: string
      clientId?: string
      employeeId?: string
      programId?: string
    }
  | {
      kind: "credit-booked" | "credit-returned"
      clientId: string
      employeeId: string
      date: string
      bookingId?: string
      programId?: string
    }

/**
 * Invalidate and explicitly refetch every query affected by a mutation.
 *
 * The dashboard QueryClient deliberately has `refetchOnMount: false` as a
 * global default. `refetchType: "all"` therefore matters here: an inactive
 * invoice or balance query must be refreshed now, rather than remaining stale
 * when a user opens that view later.
 */
export function invalidateMutationImpact(
  client: QueryClient,
  impact: MutationImpact,
): Promise<void> {
  const keys: ReadonlyArray<readonly unknown[]> = "invoiceId" in impact
    ? paymentImpactKeys(impact)
    : creditImpactKeys(impact)

  return Promise.allSettled(
    keys.map((queryKey) =>
      client.invalidateQueries({ queryKey, refetchType: "all" }),
    ),
  ).then(() => undefined)
}

function paymentImpactKeys(
  impact: Extract<MutationImpact, { kind: "payment-settled" | "payment-refunded" }>,
): ReadonlyArray<readonly unknown[]> {
  const keys: Array<readonly unknown[]> = [
    queryKeys.payments.all,
    queryKeys.payments.stats(),
    queryKeys.invoices.all,
    queryKeys.invoices.detail(impact.invoiceId),
    queryKeys.reports.dashboardHome(),
    queryKeys.reports.overviewFamily(),
    queryKeys.reports.revenueFamily(),
  ]

  if (impact.paymentId) keys.push(queryKeys.payments.detail(impact.paymentId))

  if (impact.bookingId) {
    keys.push(queryKeys.bookings.all, queryKeys.bookings.detail(impact.bookingId))
  }
  if (impact.clientId) {
    keys.push(
      queryKeys.clients.detail(impact.clientId),
      queryKeys.clients.bookings(impact.clientId),
    )
  }
  if (impact.employeeId) {
    keys.push(queryKeys.employees.detail(impact.employeeId), queryKeys.reports.employeeFamily(impact.employeeId))
  }
  if (impact.programId) keys.push(queryKeys.programs.detail(impact.programId))

  return keys
}

function creditImpactKeys(
  impact: Extract<MutationImpact, { kind: "credit-booked" | "credit-returned" }>,
): ReadonlyArray<readonly unknown[]> {
  const keys: Array<readonly unknown[]> = [
    queryKeys.bookings.all,
    queryKeys.packagePurchases.all,
    queryKeys.packagePurchases.client(impact.clientId),
    queryKeys.creditBookings.all,
    queryKeys.employees.slots(impact.employeeId, impact.date),
    queryKeys.employees.schedule(impact.employeeId),
    queryKeys.packageReports.all,
    queryKeys.reports.bookingsFamily(),
  ]

  if (impact.bookingId) keys.push(queryKeys.bookings.detail(impact.bookingId))
  if (impact.programId) keys.push(queryKeys.programs.detail(impact.programId))

  return keys
}
