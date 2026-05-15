"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { EmptyState } from "@/components/features/empty-state"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Notification03Icon } from "@hugeicons/core-free-icons"
import { ErrorBanner } from "@/components/features/error-banner"
import { NotificationCard } from "@/components/features/notifications/notification-card"
import {
  useNotifications,
  useUnreadCount,
  useNotificationMutations,
} from "@/hooks/use-notifications"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"

export default function NotificationsPage() {
  const { t } = useLocale()
  const { notifications, meta, isLoading, error, page, setPage } = useNotifications()
  const { data: unreadCount, isLoading: unreadLoading } = useUnreadCount()
  const { markAllMut, markOneMut } = useNotificationMutations()

  const handleMarkAllRead = () => {
    markAllMut.mutate()
  }

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
          onClick={handleMarkAllRead}
          disabled={markAllMut.isPending || unreadCount === 0}
          data-testid="mark-all-read"
        >
          {t("notifications.markAllRead")}
        </Button>
      </PageHeader>

      {/* Stats */}
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
            icon={Notification03Icon}
            iconColor="primary"
          />
        </StatsGrid>
      )}

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Notification list */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Notification03Icon}
          title={t("notifications.empty.title")}
          description={t("notifications.empty.description")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markOneMut.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
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
