"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Tag01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  CalendarAdd02Icon,
} from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"

import { getCategoryColumns } from "./category-columns"
import { CreateCategoryDialog } from "./create-category-dialog"
import { EditCategoryDialog } from "./edit-category-dialog"
import { DeleteCategoryDialog } from "./delete-category-dialog"

import { useCategoriesList } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import type { ServiceCategory } from "@/lib/types/service"

export function CategoryListPage() {
  const { t, locale } = useLocale()
  const {
    categories, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = useCategoriesList()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServiceCategory | null>(null)

  const activeCount = categories.filter((c) => c.isActive).length
  const inactiveCount = categories.filter((c) => !c.isActive).length
  const now = new Date()
  const newThisMonth = categories.filter((c) => {
    const created = new Date(c.createdAt)
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
  }).length

  const columns = getCategoryColumns(
    locale,
    t,
    (c) => setEditTarget(c),
    (c) => setDeleteTarget(c),
  )

  const hasFilters = search.length > 0 || isActive !== undefined

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("services.categories.title")}
        description={t("services.categories.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("services.categories.addCategory")}
        </Button>
      </PageHeader>

      {isLoading && !meta ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("services.categories.stats.total")} value={meta?.total ?? 0} icon={Tag01Icon} iconColor="primary" />
          <StatCard title={t("services.categories.stats.active")} value={activeCount} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("services.categories.stats.inactive")} value={inactiveCount} icon={Cancel01Icon} iconColor="warning" />
          <StatCard title={t("services.categories.stats.newThisMonth")} value={newThisMonth} icon={CalendarAdd02Icon} iconColor="accent" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("services.categories.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("services.categories.filters.allStatuses"),
            options: [
              { value: "all", label: t("services.categories.filters.allStatuses") },
              { value: "active", label: t("services.categories.status.active") },
              { value: "inactive", label: t("services.categories.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("services.categories.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && categories.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          emptyTitle={hasFilters ? t("services.categories.empty.searchTitle") : t("services.categories.empty.title")}
          emptyDescription={hasFilters ? t("services.categories.empty.searchDescription") : t("services.categories.empty.description")}
          emptyAction={hasFilters ? undefined : { label: t("services.categories.addCategory"), onClick: () => setCreateOpen(true) }}
        />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">{page} / {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("table.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>{t("table.next")}</Button>
          </div>
        </div>
      )}

      <CreateCategoryDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditCategoryDialog category={editTarget} open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }} />
      <DeleteCategoryDialog category={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
