"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { PermissionGuard } from "@/components/features/permission-guard"
import { RatingsManagementTab } from "@/components/features/employees/ratings-management-tab"
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

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("ratings.management.title")}
        description={t("ratings.management.description")}
      />
      <RatingsManagementTab />
    </ListPageShell>
  )
}
