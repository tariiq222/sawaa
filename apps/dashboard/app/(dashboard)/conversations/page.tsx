"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ConversationsInbox } from "@/components/features/conversations/conversations-inbox"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function ConversationsPage() {
  return (
    <PermissionGuard module="conversation" action="read">
      <ConversationsPageContent />
    </PermissionGuard>
  )
}

function ConversationsPageContent() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("conversations.title")} description={t("conversations.description")} />
      <ConversationsInbox />
    </ListPageShell>
  )
}
