import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ActivityLogTab } from "@/components/features/users/activity-log-tab"

export default function ActivityLogPage() {
  return (
    <ListPageShell>
      <Breadcrumbs />
      <ActivityLogTab />
    </ListPageShell>
  )
}
