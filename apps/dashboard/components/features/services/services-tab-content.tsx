"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { FilterBar } from "@/components/features/filter-bar"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"

import { getServiceColumns } from "./service-columns"
import { ServiceDetailSheet } from "./service-detail-sheet"

import { useServices, useCategories, useServiceMutations } from "@/hooks/use-services"
import { useBranches } from "@/hooks/use-branches"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { formatRef } from "@/lib/utils"
import type { Service } from "@/lib/types/service"

export function ServicesTabContent() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const {
    services, meta, isLoading, error,
    search, setSearch,
    categoryId, setCategoryId,
    isActive, setIsActive,
    page, setPage,
    resetFilters,
  } = useServices()
  const branchId: string | undefined = undefined
  const setBranchId = (_v: string | undefined) => { /* branch filter not supported */ }
  const { data: categories } = useCategories()
  const { branches } = useBranches()
  const { deleteMut } = useServiceMutations()
  const isMultiBranch = true

  const [detailTarget, setDetailTarget] = useState<Service | null>(null)

  const handleEdit = (s: Service) => router.push(`/services/${formatRef("SVC", s.ref)}/edit`)
  const handleDelete = async (s: Service) => {
    try {
      await deleteMut.mutateAsync(s.id)
      toast.success(t("services.delete.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("services.delete.error"))
    }
  }
  const handleRowClick = (s: Service) => setDetailTarget(s)

  const columns = getServiceColumns(locale, canDo("service", "update") ? handleEdit : undefined, canDo("service", "delete") ? handleDelete : undefined, handleRowClick, t)

  const hasFilters = search.length > 0 || !!categoryId || isActive !== undefined || !!branchId

  const statusOptions = [
    { value: "all",      label: t("services.filters.allStatuses") },
    { value: "active",   label: t("services.filters.active") },
    { value: "inactive", label: t("services.filters.inactive") },
  ]

  const categoryOptions = [
    { value: "all", label: t("services.filters.allCategories") },
    ...(categories ?? []).map((c) => ({
      value: c.id,
      label: locale === "ar" ? c.nameAr : (c.nameEn ?? c.nameAr),
    })),
  ]

  return (
    <>
      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("services.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("services.filters.allStatuses"),
            options: statusOptions,
            onValueChange: (v) => setIsActive(v === "all" ? undefined : v === "active"),
          },
          {
            key: "category",
            value: categoryId ?? "all",
            placeholder: t("services.filters.allCategories"),
            options: categoryOptions,
            onValueChange: (v) => setCategoryId(v === "all" ? undefined : v),
          },
          // Branch filter — only when multi_branch feature is enabled
          ...(isMultiBranch ? [{
            key: "branch",
            value: branchId ?? "all",
            placeholder: t("services.filters.allBranches"),
            options: [
              { value: "all", label: t("services.filters.allBranches") },
              ...branches.map((b) => ({
                value: b.id,
                label: locale === "ar" ? b.nameAr : b.nameEn,
              })),
            ],
            onValueChange: (v: string) => setBranchId(v === "all" ? undefined : v),
          }] : []),
        ]}
        hasFilters={hasFilters}
        onReset={resetFilters}
        resultCount={meta && !isLoading ? `${meta.total} ${t("services.stats.total")}` : undefined}
      />

      {/* Error */}
      {error && <ErrorBanner message={error} />}

      {/* Table */}
      {isLoading && services.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={services}
          emptyTitle={t("services.empty.title")}
          emptyDescription={t("services.empty.description")}
        />
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-2">
          <p className="tabular-nums text-sm text-muted-foreground">
            {page} / {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t("table.previous")}
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>
              {t("table.next")}
            </Button>
          </div>
        </div>
      )}

      <ServiceDetailSheet
        service={detailTarget}
        open={!!detailTarget}
        onOpenChange={(open) => { if (!open) setDetailTarget(null) }}
        onEdit={(s) => { setDetailTarget(null); handleEdit(s) }}
      />
    </>
  )
}
