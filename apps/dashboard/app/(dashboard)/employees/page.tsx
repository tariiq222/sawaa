"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, StarIcon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Button } from "@sawaa/ui"
import { EmployeesListContent } from "@/components/features/employees/employees-list-content"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"

export default function EmployeesPage() {
  return (
    <PermissionGuard module="employee" action="read">
      <Suspense><EmployeesPageInner /></Suspense>
    </PermissionGuard>
  )
}

function EmployeesPageInner() {
  const router = useRouter()
  const { t } = useLocale()
  const { canDo } = useAuth()
  const titleLabel = t("nav.employees")

  const {
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
    page,
    setPage,
  } = useEmployees()

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={titleLabel}
        description={t("employees.description")}
      >
        <Button
          variant="outline"
          className="gap-2 rounded-lg px-5"
          onClick={() => router.push("/ratings")}
        >
          <HugeiconsIcon icon={StarIcon} size={16} />
          {t("employees.tabs.ratings")}
        </Button>
        {canDo("Employee", "create") && (
          <Button className="gap-2 rounded-lg px-5" onClick={() => router.push("/employees/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("employees.addEmployee")}
          </Button>
        )}
      </PageHeader>

      <EmployeesListContent
        employees={employees}
        meta={meta}
        isLoading={isLoading}
        error={error}
        search={search}
        setSearch={setSearch}
        isActive={isActive}
        setIsActive={setIsActive}
        sortBy={sortBy}
        sortOrder={sortOrder}
        setSort={setSort}
        hasFilters={hasFilters}
        resetFilters={resetFilters}
        page={page}
        setPage={setPage}
      />

    </ListPageShell>
  )
}
