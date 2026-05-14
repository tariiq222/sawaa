"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, UserIcon } from "@hugeicons/core-free-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { fetchEmployeeRatings } from "@/lib/api/employees"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { formatDatePattern } from "@/lib/date"
import { ar } from "date-fns/locale"

/* ─── Props ─── */

interface Props {
  employeeId: string
  totalRatings?: number
  averageRating?: number
}

/* ─── Component ─── */

export function EmployeeRatingsSection({
  employeeId,
  totalRatings = 0,
  averageRating,
}: Props) {
  const { locale, t } = useLocale()
  const isAr = locale === "ar"
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.employees.ratings(employeeId), page],
    queryFn: () => fetchEmployeeRatings(employeeId, { page, perPage: 5 }),
    enabled: !!employeeId,
  })

  const ratings = data?.items ?? []
  const meta = data?.meta ?? null

  const starCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  ratings.forEach((r) => { if (r.stars >= 1 && r.stars <= 5) starCounts[r.stars]++ })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-warning/10">
            <HugeiconsIcon icon={StarIcon} size={16} className="text-warning" />
          </div>
          {t("ratings.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {/* Summary */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {averageRating != null ? averageRating.toFixed(1) : "—"}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <HugeiconsIcon
                  key={`rating-star-${i}`}
                  icon={StarIcon}
                  size={14}
                  className={
                    averageRating != null && i < Math.round(averageRating)
                      ? "text-warning"
                      : "text-muted-foreground/30"
                  }
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {totalRatings} {t("ratings.reviews")}
            </span>
          </div>
          <Separator orientation="vertical" className="h-16" />
          {/* Star bar chart */}
          <div className="flex flex-1 flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = starCounts[star] ?? 0
              const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="w-3 text-end text-xs tabular-nums text-muted-foreground">
                    {star}
                  </span>
                  <HugeiconsIcon icon={StarIcon} size={10} className="text-warning/60" />
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="rating-bar h-full rounded-full bg-warning transition-all"
                      style={{ "--bar-w": `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="w-4 text-xs tabular-nums text-muted-foreground">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Review Cards */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : ratings.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("ratings.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-muted/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                      <HugeiconsIcon icon={UserIcon} size={14} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {r.client
                        ? `${r.client.firstName} ${r.client.lastName}`
                        : t("ratings.anonymous")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <HugeiconsIcon
                          key={`review-star-${i}`}
                          icon={StarIcon}
                          size={12}
                          className={i < r.stars ? "text-warning" : "text-muted-foreground/30"}
                        />
                      ))}
                    </div>
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {r.stars}/5
                    </Badge>
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm leading-relaxed text-foreground">{r.comment}</p>
                )}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatDatePattern(r.createdAt, "MMM d, yyyy", {
                    locale: isAr ? ar : undefined,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
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
      </CardContent>
    </Card>
  )
}
