"use client"

import Link from "next/link"
import { ar } from "date-fns/locale"
import { HugeiconsIcon } from "@hugeicons/react"
import { Notification03Icon } from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@sawaa/ui"
import { ScrollArea } from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/date"
import { useLocale } from "@/components/locale-provider"
import {
  useNotifications,
  useUnreadCount,
  useNotificationMutations,
} from "@/hooks/use-notifications"
import type { Notification } from "@/lib/types/notification"

/* ─── Single notification row ─── */

function NotificationRow({
  notification,
  locale,
  onMarkRead,
}: {
  notification: Notification
  locale: "en" | "ar"
  onMarkRead: (id: string) => void
}) {
  const isUnread = !notification.isRead
  const title = notification.title
  const body = notification.body

  return (
    <button
      type="button"
      data-testid="notification-item"
      className={cn(
        "flex w-full items-start gap-3 rounded-sm px-3 py-2 text-start transition-colors hover:bg-surface-muted",
        isUnread && "bg-primary/5"
      )}
      onClick={() => isUnread && onMarkRead(notification.id)}
    >
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {isUnread ? (
          <div className="size-2 rounded-full bg-primary" />
        ) : (
          <div className="size-2" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm text-foreground line-clamp-1",
            isUnread && "font-semibold"
          )}
        >
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
          {body}
        </p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {formatRelativeTime(notification.createdAt, {
            addSuffix: true,
            locale: locale === "ar" ? ar : undefined,
          })}
        </p>
      </div>
    </button>
  )
}

/* ─── Dropdown ─── */

export function NotificationDropdown() {
  const { locale, t } = useLocale()
  const { notifications, isLoading } = useNotifications()
  const { data: unreadCount } = useUnreadCount()
  const { markAllMut, markOneMut } = useNotificationMutations()

  // Show latest 5 notifications in dropdown
  const recentNotifications = notifications.slice(0, 5)
  const hasUnread = (unreadCount ?? 0) > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          data-testid="notifications-bell"
          className="relative size-9 hover:text-primary hover:bg-primary/10"
        >
          <HugeiconsIcon icon={Notification03Icon} size={18} />
          {hasUnread && (
            <span
              data-testid="notifications-badge"
              className="absolute -top-0.5 -end-0.5 flex size-4 items-center justify-center rounded-full bg-error text-[9px] font-bold tabular-nums text-error-foreground ring-2 ring-background"
            >
              {unreadCount! > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      {/* Dropdown content */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(380px,_calc(100vw-1rem))] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t("notifications.recent")}
          </h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="mark-all-read"
              className="h-auto px-2 py-1 text-xs text-primary"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification list */}
        <ScrollArea className="max-h-[320px]">
          <div className="flex flex-col py-1">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={`skeleton-${i}`} className="h-14 rounded-md" />
                ))}
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <HugeiconsIcon
                  icon={Notification03Icon}
                  size={32}
                  className="text-muted-foreground/40"
                />
                <p className="text-sm text-muted-foreground">
                  {t("notifications.empty.title")}
                </p>
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  locale={locale}
                  onMarkRead={(id) => markOneMut.mutate(id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* Footer — view all link */}
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sm text-primary"
            asChild
          >
            <Link href="/notifications">
              {t("notifications.viewAll")}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
