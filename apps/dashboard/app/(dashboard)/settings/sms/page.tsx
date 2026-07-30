"use client"

// /settings/sms — owner-only page (SMS provider config).
// Backend endpoints require `manage:Setting` (comms.controller.ts:88,96,104).
// The guard is required defense-in-depth: backend CASL still rejects, but
// without the guard the page would render until each query returns 403.

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { PermissionGuard } from "@/components/features/permission-guard"
import { SmsDeliveryLogTable } from "@/components/features/sms/sms-delivery-log-table"
import { SmsSettingsForm } from "@/components/features/sms/sms-settings-form"
import { useLocale } from "@/components/locale-provider"

export default function SmsSettingsPage() {
  const { t } = useLocale()
  return (
    <PermissionGuard module="setting" action="manage">
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader
          title={t("sms.page.title")}
          description={t("sms.page.description")}
        />
        <SmsSettingsForm />
        <SmsDeliveryLogTable />
      </ListPageShell>
    </PermissionGuard>
  )
}
