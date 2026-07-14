"use client"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import {
  Calendar03Icon,
  Tick02Icon,
  HourglassIcon,
  InvoiceIcon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useLocale } from "@/components/locale-provider"

type Tone = "primary" | "success" | "warm" | "warning"

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warm: "bg-brand-warm-soft text-brand-warm",
  warning: "bg-warning/10 text-warning",
}

function Tile({
  icon,
  label,
  value,
  tone,
  testId,
}: {
  icon: IconSvgElement
  label: string
  value: number
  tone: Tone
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3.5 rounded-2xl border border-border bg-surface-solid p-4 shadow-sm"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          toneStyles[tone],
        )}
        aria-hidden
      >
        <HugeiconsIcon icon={icon} size={20} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="text-xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
      </div>
    </div>
  )
}

interface TodayPulseProps {
  visible: boolean
  total: number
  confirmed: number
  pending: number
  awaitingPayment: number
}

export function TodayPulse({
  visible,
  total,
  confirmed,
  pending,
  awaitingPayment,
}: TodayPulseProps) {
  const { t } = useLocale()

  if (!visible) return null

  return (
    <section
      data-testid="today-pulse"
      aria-label={t("dashboard.todayPulse.title")}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Tile
        testId="today-pulse-total"
        icon={Calendar03Icon}
        tone="primary"
        label={t("dashboard.todayPulse.total")}
        value={total}
      />
      <Tile
        testId="today-pulse-confirmed"
        icon={Tick02Icon}
        tone="success"
        label={t("dashboard.todayPulse.confirmed")}
        value={confirmed}
      />
      <Tile
        testId="today-pulse-pending"
        icon={HourglassIcon}
        tone="warm"
        label={t("dashboard.todayPulse.pending")}
        value={pending}
      />
      <Tile
        testId="today-pulse-awaiting-payment"
        icon={InvoiceIcon}
        tone="warning"
        label={t("dashboard.todayPulse.awaitingPayment")}
        value={awaitingPayment}
      />
    </section>
  )
}