"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { ErrorBanner } from "@/components/features/error-banner"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { Skeleton } from "@sawaa/ui"
import { getEmployeeColumns } from "@/components/features/employees/employee-columns"
import { DeleteEmployeeDialog } from "@/components/features/employees/delete-employee-dialog"
import { EmployeeStatusDialog } from "@/components/features/employees/employee-status-dialog"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { useEmployeeMutations } from "@/hooks/use-employee-mutations"
import type { Employee, EmployeeSortField } from "@/lib/types/employee"
import type { SortingState } from "@tanstack/react-table"

interface EmployeesListContentProps {
  employees: Employee[]
  meta: { total: number } | null
  isLoading: boolean
  error: string | null
  search: string
  setSearch: (v: string) => void
  isActive: boolean | undefined
  setIsActive: (v: boolean | undefined) => void
  sortBy?: EmployeeSortField
  sortOrder?: "asc" | "desc"
  setSort?: (sortBy: EmployeeSortField | undefined, sortOrder: "asc" | "desc" | undefined) => void
  hasFilters: boolean
  resetFilters: () => void
}

const SORT_FIELDS: readonly EmployeeSortField[] = ["name", "experience", "isActive", "createdAt"]

export function EmployeesListContent({
  employees,
  meta,
  isLoading,
  error,
  search,
  setSearch,
  isActive,
  setIsActive,
  sortBy,
  sortOrder,
  setSort,
  hasFilters,
  resetFilters,
}: EmployeesListContentProps) {
  const router = useRouter()
  const { t, locale } = useLocale()
  const { canDo } = useAuth()

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null)
  const [statusTarget, setStatusTarget] = useState<Employee | null>(null)

  const { updateMutation } = useEmployeeMutations()

  const handleEdit = (p: Employee) => router.push(`/employees/${p.id}/edit`)
  const handleDelete = (p: Employee) => setDeleteTarget(p)
  const handlePreview = (p: Employee) => router.push(`/employees/${p.id}`)
  const handleToggleActive = (p: Employee) => setStatusTarget(p)

  const statusFilter = isActive === true ? "active" : isActive === false ? "inactive" : "all"
  const handleStatusChange = (v: string) => {
    if (v === "active") setIsActive(true)
    else if (v === "inactive") setIsActive(false)
    else setIsActive(undefined)
  }

  const hasActiveFilters = hasFilters || search.length > 0
  const handleReset = () => { resetFilters(); setSearch("") }

  const columns = getEmployeeColumns(handlePreview, locale, canDo("employee", "update") ? handleEdit : undefined, canDo("employee", "delete") ? handleDelete : undefined, t, handlePreview, canDo("employee", "update") ? handleToggleActive : undefined)

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("employees.searchPlaceholder") }}
        selects={[
          {
            key: "status",
            value: statusFilter,
            placeholder: t("employees.filters.status"),
            options: [
              { value: "all", label: t("employees.filters.allStatuses") },
              { value: "active", label: t("employees.card.active") },
              { value: "inactive", label: t("employees.status.suspended") },
            ],
            onValueChange: handleStatusChange,
          },
        ]}
        hasFilters={hasActiveFilters}
        onReset={handleReset}
        resultCount={meta && !isLoading ? `${meta.total} ${t("employees.stats.total")}` : undefined}
      />

      {error && <ErrorBanner message={error} />}

      {/* Table */}
      {isLoading && employees.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          manualSorting={!!setSort}
          sorting={sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : []}
          onSortingChange={(s: SortingState) => {
            if (!setSort) return
            const next = s[0]
            if (!next) { setSort(undefined, undefined); return }
            const id = next.id as EmployeeSortField
            if (!SORT_FIELDS.includes(id)) return
            setSort(id, next.desc ? "desc" : "asc")
          }}
          emptyTitle={
            hasActiveFilters
              ? t("employees.empty.filteredTitle")
              : t("employees.empty.title")
          }
          emptyDescription={
            hasActiveFilters
              ? t("employees.empty.filteredDescription")
              : t("employees.empty.description")
          }
        />
      )}

      <DeleteEmployeeDialog
        employee={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
      />

      <EmployeeStatusDialog
        open={!!statusTarget}
        targetStatus={!statusTarget?.isActive}
        employeeName={statusTarget ? `${statusTarget.user.firstName} ${statusTarget.user.lastName}` : ""}
        onConfirm={() => {
          if (!statusTarget) return
          updateMutation.mutate({ id: statusTarget.id, isActive: !statusTarget.isActive })
          setStatusTarget(null)
        }}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  )
}
