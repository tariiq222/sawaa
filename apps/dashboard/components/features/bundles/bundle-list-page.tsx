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

import { getBundleColumns } from "./bundle-columns"
import { DeleteBundleDialog } from "./delete-bundle-dialog"

import { useBundlesList } from "@/hooks/use-bundles"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { ServiceBundle } from "@/lib/types/bundle"

export function BundleListPage() {
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const {
    bundles, meta, isLoading, error,
    search, setSearch, isActive, setIsActive,
    page, setPage, resetFilters, refetch,
  } = useBundlesList()

  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<ServiceBundle | null>(null)

  const columns = getBundleColumns(
    locale,
    t,
    canDo("service", "update") ? (b) => router.push(`/bundles/${b.id}/edit`) : undefined,
    canDo("service", "delete") ? (b) => setDeleteTarget(b) : undefined,
  )

  const hasFilters = search.length > 0 || isActive !== undefined

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("bundles.title")}
        description={t("bundles.description")}
      >
        {canDo("service", "create") && (
          <Button className="gap-2 rounded-lg px-5" onClick={() => router.push("/bundles/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("bundles.addBundle")}
          </Button>
        )}
      </PageHeader>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("bundles.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("bundles.filters.allStatuses"),
            options: [
              { value: "all", label: t("bundles.filters.allStatuses") },
              { value: "active", label: t("bundles.status.active") },
              { value: "inactive", label: t("bundles.status.inactive") },
            ],
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("bundles.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && bundles.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={bundles}
          emptyTitle={hasFilters ? t("bundles.empty.searchTitle") : t("bundles.empty.title")}
          emptyDescription={hasFilters ? t("bundles.empty.searchDescription") : t("bundles.empty.description")}
          emptyAction={hasFilters ? undefined : { label: t("bundles.addBundle"), onClick: () => router.push("/bundles/create") }}
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

      <DeleteBundleDialog bundle={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
    </ListPageShell>
  )
}
