"use client"

// SaaS-02g-sms — /settings/sms owner-only page.

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { SmsDeliveryLogTable } from "@/components/features/sms/sms-delivery-log-table"
import { SmsSettingsForm } from "@/components/features/sms/sms-settings-form"
import { useLocale } from "@/components/locale-provider"

export default function SmsSettingsPage() {
  const { t } = useLocale()
  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("sms.page.title")}
        description={t("sms.page.description")}
      />
      <SmsSettingsForm />
      <SmsDeliveryLogTable />
    </ListPageShell>
  )
}
