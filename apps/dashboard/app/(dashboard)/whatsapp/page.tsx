"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PermissionGuard } from "@/components/features/permission-guard"
import { WhatsappConversationsTab } from "@/components/features/whatsapp/tabs/whatsapp-conversations-tab"
import { useLocale } from "@/components/locale-provider"

export default function WhatsappPage() {
  const { t } = useLocale()

  return (
    <PermissionGuard module="whatsappconversation" action="read">
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader
          title={t("whatsapp.conversations.title")}
          description={t("whatsapp.conversations.pageDescription")}
        />
        <WhatsappConversationsTab />
      </ListPageShell>
    </PermissionGuard>
  )
}
