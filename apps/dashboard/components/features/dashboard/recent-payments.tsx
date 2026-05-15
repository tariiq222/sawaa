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
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

const statusConfig: Record<PaymentStatus, { tKey: string; tone: string }> = {
  paid: { tKey: "payments.status.paid", tone: "bg-success/10 text-success" },
  pending: { tKey: "payments.status.pending", tone: "bg-warning/10 text-warning" },
  refunded: { tKey: "payments.status.refunded", tone: "bg-muted text-muted-foreground" },
  failed: { tKey: "payments.status.failed", tone: "bg-error/10 text-error" },
  awaiting: { tKey: "payments.status.waiting", tone: "bg-warning/10 text-warning" },
  rejected: { tKey: "payments.status.rejected", tone: "bg-error/10 text-error" },
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
    <Card className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("dashboard.recentPayments")}</h2>
        <Link
          href="/payments"
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t("dashboard.recentPayments.viewAll")}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            className="rtl:rotate-180 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
          />
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
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.error.payments")}
        </p>
      ) : payments.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.recentPayments.noPayments")}
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 pb-3 text-start font-medium">{t("dashboard.recentPayments.colClient")}</th>
                <th className="px-2 pb-3 text-end font-medium">{t("dashboard.recentPayments.colAmount")}</th>
                <th className="px-2 pb-3 text-start font-medium">{t("dashboard.recentPayments.colMethod")}</th>
                <th className="px-2 pb-3 text-start font-medium">{t("dashboard.recentPayments.colStatus")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {payments.map((p) => {
                const s = statusConfig[p.status]
                const client = p.booking?.client
                const unknown = t("dashboard.recentPayments.unknownClient")
                const clientName = client
                  ? formatName(client.firstName, client.lastName, unknown)
                  : unknown
                const amountDisplay = formatPrice(p.amount, { locale, decimals: 2 })
                const currency = t("dashboard.currency")

                return (
                  <tr key={p.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-2 py-3 font-medium text-foreground">{clientName}</td>
                    <td className="px-2 py-3 text-end font-semibold tabular-nums text-foreground">
                      {amountDisplay} <span className="font-normal text-muted-foreground">{currency}</span>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{t(methodKey[p.method])}</td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                          s.tone,
                        )}
                      >
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
