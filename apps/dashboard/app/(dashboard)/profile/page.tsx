"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { useLocale } from "@/components/locale-provider"
import { AccountTab } from "@/components/features/profile/account-tab"
import { PermissionGuard } from "@/components/features/permission-guard"

/**
 * Profile page — displays the global User account fields and security settings.
 * Every authenticated user has 'user:read' on themselves.
 */
export default function ProfilePage() {
  return (
    <PermissionGuard module="user" action="read">
      <ProfilePageInner />
    </PermissionGuard>
  )
}

function ProfilePageInner() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <AccountTab />
    </ListPageShell>
  )
}
