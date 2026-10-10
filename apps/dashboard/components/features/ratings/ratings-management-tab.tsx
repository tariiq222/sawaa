"use client"

import { useState } from "react"
import { StarIcon } from "@hugeicons/core-free-icons"

import { RatingCard } from "./rating-card"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"

import { EmptyState } from "@/components/features/empty-state"
import { ErrorBanner } from "@/components/features/error-banner"
import { useLocale } from "@/components/locale-provider"
import { useRatings } from "@/hooks/use-ratings"

export function RatingsManagementTab() {
  const { t } = useLocale()
  const [page, setPage] = useState(1)

  const { ratings, averageRating, meta, isLoading, error, refetch } = useRatings({ page })

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

      <p className="text-sm text-muted-foreground">{t('auditOperations.averageRating')}: <strong className="tabular-nums text-foreground">{averageRating == null ? '—' : averageRating.toFixed(2)} / 5</strong></p>
      {/* Rating Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ratings.map(r => <RatingCard key={r.id} rating={r} />)}
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
