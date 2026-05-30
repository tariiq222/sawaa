"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon } from "@hugeicons/core-free-icons"

import { Card, CardContent } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"

import { EmptyState } from "@/components/features/empty-state"
import { fetchEmployeeRatings } from "@/lib/api/employees"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { formatLocaleDate } from "@/lib/date"
import type { Employee } from "@/lib/types/employee"

interface AllRatingsTabProps {
  employees: Employee[]
}

export function AllRatingsTab({ employees }: AllRatingsTabProps) {
  const { t, locale } = useLocale()
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.employees.ratings(selectedEmployee), page],
    queryFn: () =>
      fetchEmployeeRatings(selectedEmployee, { page, perPage: 20 }),
    enabled: !!selectedEmployee,
  })

  const ratings = data?.items ?? []
  const meta = data?.meta ?? null

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={StarIcon}
        title={t("ratings.noEmployees.title")}
        description={t("ratings.noEmployees.description")}
        className="min-h-[280px]"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Employee Selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">
            {t("ratings.selectEmployee")}
          </Label>
          <Select
            value={selectedEmployee}
            onValueChange={(v) => {
              setSelectedEmployee(v)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t("ratings.chooseEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.user.firstName} {p.user.lastName}
                  {p.specialty
                    ? ` — ${locale === "ar" ? (p.specialtyAr || p.specialty) : p.specialty}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {!selectedEmployee ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon icon={StarIcon} className="size-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("ratings.selectToView")}
          </p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : ratings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-sm text-muted-foreground">
            {t("ratings.empty")}
          </p>
        </div>
      ) : (
        <>
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
          <div className="flex flex-col gap-4">
            {ratings.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-start justify-between p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <HugeiconsIcon
                            key={`review-star-${i}`}
                            icon={StarIcon}
                            size={14}
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
        </>
      )}
    </div>
  )
}
