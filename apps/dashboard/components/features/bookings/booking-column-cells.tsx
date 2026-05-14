"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon, ViewIcon, PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deqah/ui"
import { StatusBadge } from "@/components/features/status-badge"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { Booking } from "@/lib/types/booking"

type QuickStatusAction = {
  action: "confirm" | "noshow"
  labelKey: string
  icon: typeof Tick01Icon
  destructive?: boolean
}

/* Quick status actions available per status */
const quickStatusActions: Record<string, QuickStatusAction[]> = {
  pending:   [{ action: "confirm", labelKey: "bookings.col.quickAction.confirm", icon: Tick01Icon }],
  confirmed: [],
}

/* ── Actions cell — delete opens the parent's AdminCancelDialog directly ── */
export function ActionsCell({
  booking: _booking,
  onView,
  onEdit,
  onDelete,
  t,
}: {
  booking: Booking
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  t: (key: string) => string
}) {
  const btnBase = "flex size-9 items-center justify-center rounded-sm border border-transparent text-muted-foreground transition-all duration-200 hover:bg-muted hover:border-border hover:text-foreground"

  return (
    <div className="flex items-center gap-1">
      <button className={btnBase} aria-label={t("bookings.col.view")} onClick={onView}>
        <HugeiconsIcon icon={ViewIcon} size={16} />
      </button>
      <button className={btnBase} aria-label={t("bookings.col.edit")} onClick={onEdit}>
        <HugeiconsIcon icon={PencilEdit01Icon} size={16} />
      </button>
      <button
        className={cn(btnBase, "hover:text-destructive hover:bg-destructive/10 hover:border-destructive/20")}
        aria-label={t("bookings.col.delete")}
        onClick={onDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} size={16} />
      </button>
    </div>
  )
}

/* ── Status cell with quick-action dropdown ── */
export function StatusCell({
  booking,
  onStatusAction,
}: {
  booking: Booking
  onStatusAction: (booking: Booking, action: "confirm" | "noshow") => void
}) {
  const { t } = useLocale()
  const actions = quickStatusActions[booking.status]
  if (!actions?.length) return <StatusBadge status={booking.status} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <StatusBadge status={booking.status} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {actions.map(({ action, labelKey, icon, destructive }) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => onStatusAction(booking, action)}
            className={destructive ? "text-destructive focus:text-destructive focus:bg-destructive/10" : ""}
          >
            <HugeiconsIcon icon={icon} size={15} className="me-2 shrink-0" />
            {t(labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
