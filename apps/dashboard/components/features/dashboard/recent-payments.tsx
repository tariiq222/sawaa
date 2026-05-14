"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { cn, formatName } from "@/lib/utils"
import { formatPrice } from "@/lib/money"
import { Card } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchPayments } from "@/lib/api/payments"
import type { PaymentStatus, PaymentMethod } from "@/lib/types/common"

const statusConfig: Record<
  PaymentStatus,
  { tKey: string; dot: string; text: string }
> = {
  paid: {
    tKey: "payments.status.paid",
    dot: "bg-success",
    text: "text-success",
  },
  pending: {
    tKey: "payments.status.pending",
    dot: "bg-warning",
    text: "text-warning",
  },
  refunded: {
    tKey: "payments.status.refunded",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  failed: {
    tKey: "payments.status.failed",
    dot: "bg-destructive",
    text: "text-destructive",
  },
  awaiting: {
    tKey: "payments.status.waiting",
    dot: "bg-warning",
    text: "text-warning",
  },
  rejected: {
    tKey: "payments.status.rejected",
    dot: "bg-destructive",
    text: "text-destructive",
  },
}

const methodKey: Record<PaymentMethod, string> = {
  moyasar: "payments.method.moyasar",
  bank_transfer: "payments.method.bankTransfer",
  cash: "payments.method.cash",
}

const RECENT_QUERY = { page: 1, perPage: 5 }

export function RecentPayments() {
  const { t, locale } = useLocale()

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.payments.list(RECENT_QUERY),
    queryFn: () => fetchPayments(RECENT_QUERY),
    staleTime: 60_000,
  })

  const payments = data?.items ?? []

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {t("dashboard.recentPayments")}
        </h2>
        <Link
          href="/payments"
          className="text-xs font-medium text-primary hover:underline"
        >
          {t("dashboard.recentPayments.viewAll")}
          <span className="inline-block rtl:rotate-180 ms-1">→</span>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`row-${i}`} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-14 rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("dashboard.error.payments")}
        </p>
      ) : payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("dashboard.recentPayments.noPayments")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-3 text-start font-medium">
                  {t("dashboard.recentPayments.colClient")}
                </th>
                <th className="pb-3 text-start font-medium">
                  {t("dashboard.recentPayments.colAmount")}
                </th>
                <th className="pb-3 text-start font-medium">
                  {t("dashboard.recentPayments.colMethod")}
                </th>
                <th className="pb-3 text-start font-medium">
                  {t("dashboard.recentPayments.colStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const s = statusConfig[p.status]
                const client = p.booking?.client
                const unknown = t("dashboard.recentPayments.unknownClient")
                const clientName = client
                  ? formatName(client.firstName, client.lastName, unknown)
                  : unknown
                const amountDisplay = formatPrice(p.amount, { locale, decimals: 2 })

                return (
                  <tr
                    key={p.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 font-medium text-foreground">
                      {clientName}
                    </td>
                    <td className="py-3 tabular-nums text-foreground">
                      {amountDisplay} {t("dashboard.currency")}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {t(methodKey[p.method])}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          s.text,
                        )}
                      >
                        <span className={cn("size-2 rounded-full", s.dot)} />
                        {t(s.tKey)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
