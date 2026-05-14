"use client"

import Link from "next/link"
import { Card } from "@deqah/ui"
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
  general: "bg-muted-foreground",
}

function timeAgo(
  dateStr: string,
  t: (key: string) => string,
): string {
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
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">
          {t("dashboard.recentActivity")}
        </h2>
        <Link
          href="/notifications"
          className="text-xs font-medium text-primary hover:underline"
        >
          {t("dashboard.activity.all")}
          <span className="inline-block rtl:rotate-180 ms-1">→</span>
        </Link>
      </div>

      {notifications.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("dashboard.noActivity")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {notifications.slice(0, 5).map((n) => {
            const dotColor = typeColors[n.type] ?? "bg-muted-foreground"
            return (
              <div key={n.id} className="flex items-start gap-3">
                <div className="mt-1.5 flex shrink-0">
                  <span className={`size-2.5 rounded-full ${dotColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(n.createdAt, t)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
