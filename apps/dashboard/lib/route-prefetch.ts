/**
 * Route Query Prefetch Map — Deqah Dashboard
 *
 * Maps each sidebar route to the queryKey + queryFn of its primary list query.
 * Called on sidebar hover BEFORE the user clicks, so by click time the data
 * is already in the React Query cache → zero skeleton on first visit.
 *
 * Rules:
 * - Only list-level queries (no detail / stats — those depend on user action)
 * - Default params only (page 1, no filters)
 * - Must match the exact queryKey used in the corresponding hook
 */

import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookings } from "@/lib/api/bookings"
import { fetchClients } from "@/lib/api/clients"
import { fetchEmployees } from "@/lib/api/employees"
import { fetchPayments } from "@/lib/api/payments"
import { fetchServices } from "@/lib/api/services"
import { fetchUsers } from "@/lib/api/users"
import { fetchBranches } from "@/lib/api/branches"
import { fetchCoupons } from "@/lib/api/coupons"
import { fetchIntakeForms } from "@/lib/api/intake-forms"
import { fetchNotifications } from "@/lib/api/notifications"
import { fetchChatSessions } from "@/lib/api/chatbot"

type PrefetchEntry = (qc: QueryClient) => Promise<void>

const DEFAULT_STALE = 5 * 60_000   // match QueryProvider default

function entry(
  queryKey: readonly unknown[],
  queryFn: () => Promise<unknown>,
): PrefetchEntry {
  return (qc) =>
    qc.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: DEFAULT_STALE,
    })
}

/**
 * href → prefetch function.
 * Only routes with a clear, parameterless primary list query are included.
 */
export const ROUTE_PREFETCH: Record<string, PrefetchEntry> = {
  "/bookings": entry(
    queryKeys.bookings.list({ page: 1, perPage: 20 }),
    () => fetchBookings({ page: 1, perPage: 20 }),
  ),
  "/clients": entry(
    queryKeys.clients.list({ page: 1, perPage: 20 }),
    () => fetchClients({ page: 1, perPage: 20 }),
  ),
  "/employees": entry(
    queryKeys.employees.list({ page: 1, perPage: 20 }),
    () => fetchEmployees({ page: 1, perPage: 20 }),
  ),
  "/payments": entry(
    queryKeys.payments.list({ page: 1, perPage: 20 }),
    () => fetchPayments({ page: 1, perPage: 20 }),
  ),
  "/services": entry(
    queryKeys.services.list({}),
    () => fetchServices({}),
  ),
  "/users": entry(
    queryKeys.users.list({ page: 1, perPage: 20 }),
    () => fetchUsers({ page: 1, perPage: 20 }),
  ),
  "/branches": entry(
    queryKeys.branches.list(),
    () => fetchBranches(),
  ),
  "/coupons": entry(
    queryKeys.coupons.list({ page: 1, perPage: 20 }),
    () => fetchCoupons({ page: 1, perPage: 20 }),
  ),
  "/intake-forms": entry(
    queryKeys.intakeForms.list({}),
    () => fetchIntakeForms({}),
  ),
  "/notifications": entry(
    queryKeys.notifications.list({ page: 1, perPage: 20 }),
    () => fetchNotifications({ page: 1, perPage: 20 }),
  ),
  "/chatbot": entry(
    queryKeys.chatbot.sessions.list({ page: 1, perPage: 20 }),
    () => fetchChatSessions({ page: 1, perPage: 20 }),
  ),
}

/**
 * Call this in the sidebar's onMouseEnter for each nav item.
 * Silently no-ops for routes without a prefetch entry (e.g. /reports, /settings).
 */
export function prefetchRouteData(
  href: string,
  queryClient: QueryClient,
): void {
  const prefetch = ROUTE_PREFETCH[href]
  if (!prefetch) return
  prefetch(queryClient).catch(() => {
    // silently ignore — prefetch failures are non-critical
  })
}
