"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, InvoiceIcon, CancelCircleIcon } from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { useLocale } from "@/components/locale-provider"
import type { VisibleWidgets } from "@/lib/dashboard-widgets"

interface AttentionAlertsProps {
  pendingPayments: number
  cancelRequests: number
  visible: VisibleWidgets["attentionAlerts"]
}

type Severity = "warning" | "error"

const sevStyles: Record<
  Severity,
  { surface: string; ring: string; iconBg: string; iconText: string; count: string }
> = {
  warning: {
    surface: "bg-warning/10",
    ring: "ring-warning/15",
    iconBg: "bg-warning/10",
    iconText: "text-warning",
    count: "text-warning",
  },
  error: {
    surface: "bg-error/10",
    ring: "ring-error/15",
    iconBg: "bg-error/10",
    iconText: "text-error",
    count: "text-error",
  },
}

interface AlertTileProps {
  href: string
  testId: string
  count: number
  label: string
  hint: string
  icon: IconSvgElement
  severity: Severity
}

function AlertTile({ href, testId, count, label, hint, icon, severity }: AlertTileProps) {
  const s = sevStyles[severity]
  return (
    <Link href={href} data-testid={testId} className="group block">
      <div
        className={cn(
          "relative flex items-center gap-4 rounded-2xl p-4 pe-5 ring-1 transition-colors duration-200",
          s.surface,
          s.ring,
          "hover:bg-card",
        )}
      >
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            s.iconBg,
            s.iconText,
          )}
          aria-hidden
        >
          <HugeiconsIcon icon={icon} size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={cn("text-2xl font-semibold leading-none tabular-nums", s.count)}>
              {count}
            </span>
            <span className="truncate text-sm font-medium text-foreground">{label}</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        </div>

        <span
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5",
            s.iconText,
          )}
          aria-hidden
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="rtl:rotate-180" />
        </span>
      </div>
    </Link>
  )
}

export function AttentionAlerts({ pendingPayments, cancelRequests, visible }: AttentionAlertsProps) {
  const { t } = useLocale()

  const showPayments = visible.pendingPayments && pendingPayments > 0
  const showCancels = visible.cancelRequests && cancelRequests > 0

  if (!showPayments && !showCancels) return null

  return (
    <div data-testid="attention-alerts" className="grid gap-3 sm:grid-cols-2">
      {showPayments && (
        <AlertTile
          href="/payments"
          testId="alert-pending-payments"
          count={pendingPayments}
          label={t("alerts.pendingPayments")}
          hint={t("alerts.pendingPaymentsDesc")}
          icon={InvoiceIcon}
          severity="warning"
        />
      )}
      {showCancels && (
        <AlertTile
          href="/bookings"
          testId="alert-cancel-requests"
          count={cancelRequests}
          label={t("alerts.cancelRequests")}
          hint={t("alerts.cancelRequestsDesc")}
          icon={CancelCircleIcon}
          severity="error"
        />
      )}
    </div>
  )
}
