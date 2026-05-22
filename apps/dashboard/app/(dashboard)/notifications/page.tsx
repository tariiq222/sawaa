"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { EmptyState } from "@/components/features/empty-state"
import { Skeleton, Button } from "@sawaa/ui"
import { Notification03Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { ErrorBanner } from "@/components/features/error-banner"
import { NotificationCard } from "@/components/features/notifications/notification-card"
import {
  useUnreadCount,
  useNotificationMutations,
} from "@/hooks/use-notifications"
import { fetchNotifications } from "@/lib/api/notifications"
import { queryKeys } from "@/lib/query-keys"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { PermissionGuard } from "@/components/features/permission-guard"
import type { Notification, NotificationListQuery } from "@/lib/types/notification"

function groupByDay(items: Notification[], t: (k: string) => string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: Record<string, Notification[]> = {}
  const order: string[] = []

  for (const n of items) {
    const d = new Date(n.createdAt)
    d.setHours(0, 0, 0, 0)
    let key: string
    if (d.getTime() === today.getTime()) {
      key = t("notifications.timeline.today")
    } else if (d.getTime() === yesterday.getTime()) {
      key = t("notifications.timeline.yesterday")
    } else {
      key = t("notifications.timeline.earlier")
    }
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push(n)
  }
  return order.map((label) => ({ label, items: groups[label] }))
}

function NotificationsContent() {
  const { t } = useLocale()
  const [page, setPage] = useState(1)
  const query: NotificationListQuery = { page, perPage: 50 }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.notifications.list(query),
    queryFn: () => fetchNotifications(query),
    staleTime: 60_000,
  })

  const notifications = data?.items ?? []
  const meta = data?.meta ?? null
  const { data: unreadCount, isLoading: unreadLoading } = useUnreadCount()
  const { markAllMut, markOneMut } = useNotificationMutations()

  const groups = useMemo(
    () => groupByDay(notifications, t),
    [notifications, t],
  )

  const totalCount = meta?.total ?? notifications.length

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllMut.mutate()}
          disabled={markAllMut.isPending || unreadCount === 0}
          data-testid="mark-all-read"
        >
          {t("notifications.markAllRead")}
        </Button>
      </PageHeader>

      {unreadLoading ? (
        <StatsGrid className="lg:grid-cols-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </StatsGrid>
      ) : (
        <StatsGrid className="lg:grid-cols-2">
          <StatCard
            title={t("notifications.unread")}
            value={unreadCount ?? 0}
            icon={Notification03Icon}
            iconColor="warning"
          />
          <StatCard
            title={t("notifications.total")}
            value={totalCount}
            icon={CheckmarkCircle02Icon}
            iconColor="primary"
          />
        </StatsGrid>
      )}

      {error && <ErrorBanner message={error.message} />}

      {isLoading ? (
        <div className="flex flex-col gap-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-14 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Notification03Icon}
          title={t("notifications.empty.title")}
          description={t("notifications.empty.description")}
        />
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {group.items.length}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="flex flex-col">
                {group.items.map((n, idx) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={(id) => markOneMut.mutate(id)}
                    isLast={idx === group.items.length - 1}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            {page} / {meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("pagination.prev")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </ListPageShell>
  )
}

export default function NotificationsPage() {
  return (
    <PermissionGuard module="setting" action="read">
      <NotificationsContent />
    </PermissionGuard>
  )
}
