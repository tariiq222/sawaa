"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Building06Icon,
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
import { getDepartmentColumns } from "@/components/features/departments/department-columns"
import { CreateDepartmentDialog } from "@/components/features/departments/create-department-dialog"
import { EditDepartmentDialog } from "@/components/features/departments/edit-department-dialog"
import { DeleteDepartmentDialog } from "@/components/features/departments/delete-department-dialog"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useDepartments, useDepartmentStats, useDepartmentMutations } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import type { Department } from "@/lib/types/department"

export function DepartmentListPage() {
  const { t, locale } = useLocale()
  const {
    departments, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = useDepartments()

  const stats = useDepartmentStats()
  const { updateMut } = useDepartmentMutations()

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)

  const hasFilters = search.length > 0 || isActive !== undefined

  const columns = getDepartmentColumns(
    locale,
    t,
    (d) => setEditTarget(d),
    (d) => setDeleteTarget(d),
    (d) => updateMut.mutate({ id: d.id, isActive: !d.isActive }),
  )

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("departments.title")}
        description={t("departments.description")}
      >
        <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} size={16} />
          {t("departments.addDepartment")}
        </Button>
      </PageHeader>

      {stats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <StatsGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("departments.stats.total")} value={stats.total} icon={Building06Icon} iconColor="primary" />
          <StatCard title={t("departments.stats.active")} value={stats.active} icon={CheckmarkCircle02Icon} iconColor="success" />
          <StatCard title={t("departments.stats.inactive")} value={stats.inactive} icon={Cancel01Icon} iconColor="warning" />
          <StatCard title={t("departments.stats.newThisMonth")} value={stats.newThisMonth} icon={CalendarAdd02Icon} iconColor="accent" />
        </StatsGrid>
      )}

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("departments.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("departments.filters.allStatuses"),
            options: [
              { value: "all", label: t("departments.filters.allStatuses") },
              { value: "active", label: t("departments.status.active") },
              { value: "inactive", label: t("departments.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("departments.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && departments.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={departments}
          emptyTitle={hasFilters ? t("departments.empty.noMatches.title") : t("departments.empty.title")}
          emptyDescription={hasFilters ? t("departments.empty.noMatches.description") : t("departments.empty.description")}
          emptyAction={
            hasFilters
              ? { label: t("departments.filters.reset"), onClick: resetFilters }
              : { label: t("departments.addDepartment"), onClick: () => setCreateOpen(true) }
          }
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

      <CreateDepartmentDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditDepartmentDialog department={editTarget} open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null) }} />
      <DeleteDepartmentDialog department={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
