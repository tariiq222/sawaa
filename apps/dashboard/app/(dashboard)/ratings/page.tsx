"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { PermissionGuard } from "@/components/features/permission-guard"
import { AllRatingsTab } from "@/components/features/employees/all-ratings-tab"
import { useEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"

export default function RatingsPage() {
  return (
    <PermissionGuard module="employee" action="read">
      <RatingsPageInner />
    </PermissionGuard>
  )
}

function RatingsPageInner() {
  const { t } = useLocale()
  const { employees } = useEmployees()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("employees.ratings.title")}
        description={t("employees.ratings.description")}
      />
      <AllRatingsTab employees={employees} />
    </ListPageShell>
  )
}
