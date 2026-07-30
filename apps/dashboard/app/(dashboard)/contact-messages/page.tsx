"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { ContactMessagesTable } from "@/components/features/contact-messages/contact-messages-table"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ContactMessagesPage() {
  return (
    <PermissionGuard module="setting" action="read">
      <ContactMessagesPageInner />
    </PermissionGuard>
  )
}

function ContactMessagesPageInner() {
  const { t } = useLocale()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("contactMessages.title")}
        description={t("contactMessages.description")}
      />
      <ContactMessagesTable />
    </ListPageShell>
  )
}
