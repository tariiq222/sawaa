"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { Button } from "@sawaa/ui"
import { ServicesTabContent } from "@/components/features/services/services-tab-content"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function ServicesPage() {
  const { t } = useLocale()
  const router = useRouter()
  const { canDo } = useAuth()

  return (
    <PermissionGuard module="service" action="read">
      <ListPageShell>
        <Breadcrumbs />

        <PageHeader
          title={t("services.title")}
          description={t("services.description")}
        >
          {canDo("Service", "create") && (
            <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/services/create")}>
              <HugeiconsIcon icon={Add01Icon} size={16} />
              {t("services.addService")}
            </Button>
          )}
        </PageHeader>

        <ServicesTabContent />
      </ListPageShell>
    </PermissionGuard>
  )
}
