"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { DataTable } from "@/components/features/data-table"
import { ErrorBanner } from "@/components/features/error-banner"
import { getBranchColumns } from "@/components/features/branches/branch-columns"
import { DeleteBranchDialog } from "@/components/features/branches/delete-branch-dialog"
import { BranchEmployeesDialog } from "@/components/features/branches/branch-employees-dialog"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { FilterBar } from "@/components/features/filter-bar"
import { toast } from "sonner"
import { useBranches, useBranchMutations } from "@/hooks/use-branches"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { Branch } from "@/lib/types/branch"

export function BranchListPage() {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const { branches, meta, isLoading, error, search, setSearch, isActive, setIsActive, setPage } = useBranches()
  const { updateMut } = useBranchMutations()

  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null)
  const [employeesTarget, setEmployeesTarget] = useState<Branch | null>(null)

  const handleToggleActive = async (b: Branch) => {
    try {
      await updateMut.mutateAsync({ id: b.id, isActive: !b.isActive })
      toast.success(t("branches.edit.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branches.edit.error"))
    }
  }

  const handleSetPrimary = async (b: Branch) => {
    try {
      await updateMut.mutateAsync({ id: b.id, isMain: true })
      toast.success(t("branches.edit.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("branches.edit.error"))
    }
  }

  const columns = getBranchColumns(
    locale,
    canDo("branch", "update") ? (b) => router.push(`/branches/${b.id}/edit`) : undefined,
    canDo("branch", "delete") ? (b) => setDeleteTarget(b) : undefined,
    t,
    (b) => setEmployeesTarget(b),
    canDo("branch", "update") ? handleToggleActive : undefined,
    handleSetPrimary,
  )

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("branches.title")}
        description={t("branches.description")}
      >
        {canDo("Branch", "create") && (
          <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/branches/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("branches.addBranch")}
          </Button>
        )}
      </PageHeader>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("branches.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
            placeholder: t("branches.filters.allStatuses"),
            options: [
              { value: "all", label: t("branches.filters.allStatuses") },
              { value: "active", label: t("branches.status.active") },
              { value: "inactive", label: t("branches.status.inactive") },
            ],
            onValueChange: (v) => { if (v === "all") setIsActive(undefined); else setIsActive(v === "active"); setPage(1) },
          },
        ]}
        hasFilters={search.length > 0 || isActive !== undefined}
        onReset={() => { setSearch(""); setIsActive(undefined); setPage(1) }}
        resultCount={meta && !isLoading ? `${meta.total} ${t("branches.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {isLoading && branches.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
        </div>
      ) : (
        <DataTable columns={columns} data={branches} serverPaginated emptyTitle={t("branches.empty.title")} emptyDescription={t("branches.empty.description")} emptyAction={canDo("Branch", "create") ? { label: t("branches.addBranch"), onClick: () => router.push("/branches/create") } : undefined} />
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("table.pagination.page")} {meta.page} {t("table.pagination.of")} {meta.totalPages}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!meta.hasPreviousPage} onClick={() => setPage(meta.page - 1)}>{t("table.pagination.previous")}</Button>
            <Button variant="outline" size="sm" disabled={!meta.hasNextPage} onClick={() => setPage(meta.page + 1)}>{t("table.pagination.next")}</Button>
          </div>
        </div>
      )}

      <DeleteBranchDialog branch={deleteTarget} open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }} />
      <BranchEmployeesDialog branch={employeesTarget} open={!!employeesTarget} onOpenChange={(o) => { if (!o) setEmployeesTarget(null) }} />
    </ListPageShell>
  )
}
