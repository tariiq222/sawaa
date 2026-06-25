"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { ErrorBanner } from "@/components/features/error-banner"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"

import { getPackageColumns } from "./package-columns"
import { DeletePackageDialog } from "./delete-package-dialog"

import { usePackagesList } from "@/hooks/use-packages"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { SessionPackage } from "@/lib/types/package"

export function PackageListPage() {
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const {
    packages, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = usePackagesList()

  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<SessionPackage | null>(null)

  const columns = getPackageColumns(
    locale,
    t,
    canDo("service", "update") ? (p) => router.push(`/packages/${p.id}/edit`) : undefined,
    canDo("service", "delete") ? (p) => setDeleteTarget(p) : undefined,
  )

  const hasFilters = search.length > 0 || isActive !== undefined

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("packages.title")}
        description={t("packages.description")}
      >
        {canDo("service", "create") && (
          <Button className="gap-2 rounded-lg px-5" onClick={() => router.push("/packages/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("packages.addPackage")}
          </Button>
        )}
      </PageHeader>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("packages.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("packages.filters.allStatuses"),
            options: [
              { value: "all", label: t("packages.filters.allStatuses") },
              { value: "active", label: t("packages.status.active") },
              { value: "inactive", label: t("packages.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("packages.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && packages.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={packages}
          emptyTitle={hasFilters ? t("packages.empty.searchTitle") : t("packages.empty.title")}
          emptyDescription={hasFilters ? t("packages.empty.searchDescription") : t("packages.empty.description")}
          emptyAction={hasFilters ? undefined : { label: t("packages.addPackage"), onClick: () => router.push("/packages/create") }}
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

      <DeletePackageDialog pkg={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
