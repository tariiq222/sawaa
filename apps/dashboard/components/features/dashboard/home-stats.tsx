"use client"

import type { ReactNode } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Calendar03Icon,
  UserGroupIcon,
  Money01Icon,
  InvoiceIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import type { VisibleWidgets } from "@/lib/dashboard-widgets"
import type { OverviewReport } from "@/lib/types/report"

type Tone = "primary" | "success" | "warm" | "warning"

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  warm: "bg-brand-warm-soft text-brand-warm",
  warning: "bg-warning-soft text-warning",
}

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconSvgElement
  label: string
  value: ReactNode
  tone: Tone
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-solid p-4 shadow-sm">
      <span
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", toneStyles[tone])}
        aria-hidden
      >
        <HugeiconsIcon icon={icon} size={22} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    </div>
  )
}

interface HomeStatsProps {
  overview: OverviewReport | undefined
  pendingPayments: number
  visible: VisibleWidgets["stats"]
  isLoading: boolean
}

export function HomeStats({ overview, pendingPayments, visible, isLoading }: HomeStatsProps) {
  const { locale, t } = useLocale()

  const tiles = [
    {
      key: "bookings",
      show: visible.bookings,
      node: (
        <StatTile
          icon={Calendar03Icon}
          tone="primary"
          label={t("reports.overview.totalBookings")}
          value={overview?.totalBookings ?? 0}
        />
      ),
    },
    {
      key: "clients",
      show: visible.clients,
      node: (
        <StatTile
          icon={UserGroupIcon}
          tone="success"
          label={t("reports.overview.newClients")}
          value={overview?.newClients ?? 0}
        />
      ),
    },
    {
      key: "revenue",
      show: visible.revenue,
      node: (
        <StatTile
          icon={Money01Icon}
          tone="warm"
          label={t("reports.overview.totalRevenue")}
          value={<FormattedCurrency amount={overview?.totalRevenue ?? 0} locale={locale} />}
        />
      ),
    },
    {
      key: "pending",
      show: visible.pendingPayments,
      node: (
        <StatTile
          icon={InvoiceIcon}
          tone="warning"
          label={t("alerts.pendingPayments")}
          value={pendingPayments}
        />
      ),
    },
  ].filter((x) => x.show)

  if (tiles.length === 0) return null

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.key} className="h-[76px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((x) => (
        <div key={x.key}>{x.node}</div>
      ))}
    </div>
  )
}
