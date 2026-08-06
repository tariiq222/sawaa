"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { PermissionGuard } from "@/components/features/permission-guard"
import { CreateClientForm } from "@/components/features/clients/create-client-form"

export default function CreateClientPage() {
  return (
    <PermissionGuard module="client" action="create">
      <CreateClientRoute />
    </PermissionGuard>
  )
}

function CreateClientRoute() {
  const { t } = useLocale()

  return (
    <ListPageShell>
      <Breadcrumbs
        items={[
          { label: t("clients.title"), href: "/clients" },
          { label: t("clients.create.title") },
        ]}
      />
      <PageHeader title={t("clients.create.title")} description={t("clients.create.description")} />
      <CreateClientForm />
    </ListPageShell>
  )
}
