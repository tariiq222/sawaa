"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { ActivityLogTab } from "@/components/features/activity-log/activity-log-tab"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function ActivityLogPage() {
  return (
    <PermissionGuard module="setting" action="read">
      <ActivityLogPageInner />
    </PermissionGuard>
  )
}

function ActivityLogPageInner() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("activityLog.title")}
        description={t("activityLog.description")}
      />
      <ActivityLogTab />
    </ListPageShell>
  )
}
