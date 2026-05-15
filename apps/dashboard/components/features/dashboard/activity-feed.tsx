"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import type { Notification } from "@/lib/types/notification"

interface ActivityFeedProps {
  notifications: Notification[]
}

const typeColors: Record<string, string> = {
  booking_confirmed: "bg-primary",
  booking_completed: "bg-success",
  booking_cancelled: "bg-error",
  payment_received: "bg-success",
  cancellation_request: "bg-warning",
  problem_report: "bg-error",
  rating_received: "bg-info",
  general: "bg-muted-foreground/50",
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t("dashboard.timeAgo.now")
  if (mins < 60) return t("dashboard.timeAgo.minutes").replace("{mins}", String(mins))
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("dashboard.timeAgo.hours").replace("{hours}", String(hours))
  return t("dashboard.timeAgo.days").replace("{days}", String(Math.floor(hours / 24)))
}

export function ActivityFeed({ notifications }: ActivityFeedProps) {
  const { t } = useLocale()

  return (
    <Card className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">{t("dashboard.recentActivity")}</h2>
        <Link
          href="/notifications"
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          {t("dashboard.activity.all")}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            size={12}
            className="rtl:rotate-180 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:rtl:group-hover:-translate-x-0.5"
          />
        </Link>
      </div>

      {notifications.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("dashboard.noActivity")}
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col divide-y divide-border/70">
          {notifications.slice(0, 5).map((n) => {
            const dot = typeColors[n.type] ?? "bg-muted-foreground/50"
            return (
              <li key={n.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                <span
                  className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", dot)}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-foreground">{n.title}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {timeAgo(n.createdAt, t)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
