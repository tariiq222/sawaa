"use client"

import { ar, enUS } from "date-fns/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarAdd02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Clock02Icon,
  MoneyReceiveSquareIcon,
  AlertCircleIcon,
  CreditCardIcon,
  UserAdd01Icon,
  Notification03Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { formatRelativeTime, formatDatePattern } from "@/lib/date"
import { useLocale } from "@/components/locale-provider"
import type { Notification } from "@/lib/types/notification"

interface NotificationCardProps {
  notification: Notification
  onMarkRead: (id: string) => void
  isLast?: boolean
}

type Tone = "success" | "warning" | "error" | "info" | "muted"

const TYPE_MAP: Record<string, { icon: typeof CalendarAdd02Icon; tone: Tone }> = {
  BOOKING_CREATED: { icon: CalendarAdd02Icon, tone: "success" },
  BOOKING_CONFIRMED: { icon: CheckmarkCircle02Icon, tone: "success" },
  BOOKING_CANCELLED: { icon: Cancel01Icon, tone: "error" },
  BOOKING_REMINDER: { icon: Clock02Icon, tone: "warning" },
  PAYMENT_COMPLETED: { icon: MoneyReceiveSquareIcon, tone: "success" },
  PAYMENT_RECEIVED: { icon: MoneyReceiveSquareIcon, tone: "success" },
  PAYMENT_FAILED: { icon: AlertCircleIcon, tone: "error" },
  PAYMENT_REMINDER: { icon: CreditCardIcon, tone: "warning" },
  WELCOME: { icon: UserAdd01Icon, tone: "info" },
  GENERAL: { icon: Notification03Icon, tone: "muted" },
}

const TONE_STYLES: Record<Tone, { ring: string; bg: string; fg: string }> = {
  success: {
    ring: "ring-success/15",
    bg: "bg-success/10",
    fg: "text-success",
  },
  warning: {
    ring: "ring-warning/15",
    bg: "bg-warning/10",
    fg: "text-warning",
  },
  error: {
    ring: "ring-error/15",
    bg: "bg-error/10",
    fg: "text-error",
  },
  info: {
    ring: "ring-primary/15",
    bg: "bg-primary/10",
    fg: "text-primary",
  },
  muted: {
    ring: "ring-border",
    bg: "bg-muted",
    fg: "text-muted-foreground",
  },
}

export function NotificationCard({
  notification,
  onMarkRead,
  isLast = false,
}: NotificationCardProps) {
  const { locale, t } = useLocale()
  const dateLocale = locale === "ar" ? ar : enUS
  const isUnread = !notification.isRead
  const { icon, tone } = TYPE_MAP[notification.type] ?? TYPE_MAP.GENERAL
  const toneClasses = TONE_STYLES[tone]

  const typeKey = `notifications.types.${notification.type}` as const
  const typeLabel = t(typeKey) || notification.title

  const handleClick = () => {
    if (isUnread) onMarkRead(notification.id)
  }

  return (
    <div
      className="group relative flex items-start gap-3 sm:gap-4"
      data-testid="notification-card"
    >
      {/* Timeline rail + node */}
      <div className="relative flex flex-col items-center pt-1">
        <div
          className={cn(
            "relative z-10 flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-border transition-transform duration-200 group-hover:scale-105",
          )}
        >
          <HugeiconsIcon
            icon={icon}
            size={16}
            className={toneClasses.fg}
            strokeWidth={2}
          />
          {isUnread && (
            <span className="absolute -top-0.5 -end-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 bg-border/60" />
        )}
      </div>

      {/* Content */}
      <button
        type="button"
        onClick={handleClick}
        disabled={!isUnread}
        className={cn(
          "flex flex-1 min-w-0 flex-col gap-1 rounded-xl border border-border/50 bg-card px-3 py-2.5 text-start transition-all duration-200",
          "hover:border-border hover:shadow-sm",
          isUnread && "border-primary/30 shadow-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          !isUnread && "cursor-default",
          "mb-3",
        )}
      >
        {/* Row 1: type tag + title + time */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
              toneClasses.bg,
              toneClasses.fg,
            )}
          >
            {typeLabel}
          </span>
          <span
            className={cn(
              "flex-1 truncate text-sm text-foreground",
              isUnread && "font-semibold",
            )}
          >
            {notification.title}
          </span>
          <time
            dateTime={notification.createdAt}
            className="text-[11px] tabular-nums text-muted-foreground"
            title={formatDatePattern(notification.createdAt, "PPpp", {
              locale: dateLocale,
            })}
          >
            {formatRelativeTime(notification.createdAt, {
              addSuffix: true,
              locale: dateLocale,
            })}
          </time>
        </div>

        {/* Row 2: body (1 line, 2 max) */}
        {notification.body && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {notification.body}
          </p>
        )}
      </button>
    </div>
  )
}
