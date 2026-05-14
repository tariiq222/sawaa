"use client"

import { ar } from "date-fns/locale"
import { Card, CardContent } from "@deqah/ui"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/date"
import { useLocale } from "@/components/locale-provider"
import type { Notification } from "@/lib/types/notification"

interface NotificationCardProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

export function NotificationCard({
  notification,
  onMarkRead,
}: NotificationCardProps) {
  const { locale } = useLocale()
  const isUnread = !notification.isRead

  const handleClick = () => {
    if (isUnread) {
      onMarkRead(notification.id)
    }
  }

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 hover:shadow-sm",
        isUnread && "border-primary/20 bg-primary/5"
      )}
      onClick={handleClick}
      data-testid="notification-card"
    >
      <CardContent className="flex items-start gap-4 p-4">
        {/* Unread dot */}
        <div className="mt-1.5 flex-shrink-0">
          {isUnread ? (
            <div className="size-2.5 rounded-full bg-primary" />
          ) : (
            <div className="size-2.5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm text-foreground",
              isUnread && "font-semibold"
            )}
          >
            {notification.title}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {formatRelativeTime(notification.createdAt, {
              addSuffix: true,
              locale: locale === "ar" ? ar : undefined,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
