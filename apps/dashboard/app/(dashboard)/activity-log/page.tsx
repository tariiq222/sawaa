import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ActivityLogTab } from "@/components/features/users/activity-log-tab"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ActivityLogPage() {
  return (
    <PermissionGuard module="setting" action="read">
      <ListPageShell>
        <Breadcrumbs />
        <ActivityLogTab />
      </ListPageShell>
    </PermissionGuard>
  )
}
