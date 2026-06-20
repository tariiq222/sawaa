"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"

import { Card, CardContent } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"

import { EmptyState } from "@/components/features/empty-state"
import { ErrorBanner } from "@/components/features/error-banner"
import { useLocale } from "@/components/locale-provider"
import { formatLocaleDate } from "@/lib/date"
import { useRatings, useRatingMutations } from "@/hooks/use-ratings"

export function RatingsManagementTab() {
  const { t, locale } = useLocale()
  const [page, setPage] = useState(1)

  const { ratings, meta, isLoading, error, refetch } = useRatings({ page })
  const { updateVisibility } = useRatingMutations()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={() => refetch()} />
  }

  if (ratings.length === 0) {
    return (
      <EmptyState
        icon={StarIcon}
        title={t("ratings.empty.title")}
        description={t("ratings.empty.description")}
        className="min-h-[280px]"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <span>
          {t("ratings.totalRatings")}:{" "}
          <strong className="tabular-nums text-foreground">
            {meta?.total ?? 0}
          </strong>
        </span>
      </div>

      {/* Rating Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ratings.map((r) => (
          <Card key={r.id} className="h-full">
            <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <HugeiconsIcon
                        key={`review-star-${i}`}
                        icon={StarIcon}
                        size={14}
                        fill={i < r.stars ? "currentColor" : "none"}
                        className={
                          i < r.stars
                            ? "text-warning"
                            : "text-muted-foreground/30"
                        }
                      />
                    ))}
                  </div>
                  <Badge variant="secondary" className="text-[10px] tabular-nums">
                    {r.stars}/5
                  </Badge>
                </div>
                {r.comment && (
                  <p className="text-sm text-foreground">{r.comment}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {r.client?.name ?? t("ratings.anonymous")}
                  {" · "}
                  <span className="tabular-nums">
                    {formatLocaleDate(r.createdAt, locale)}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {r.isPublic ? t("ratings.public") : t("ratings.private")}
                </span>
                <Switch
                  checked={r.isPublic}
                  onCheckedChange={(checked) =>
                    updateVisibility.mutate({ id: r.id, isPublic: checked })
                  }
                  disabled={updateVisibility.isPending}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasPreviousPage}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("ratings.previous")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {page} / {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("ratings.next")}
          </Button>
        </div>
      )}
    </div>
  )
}
