import { Suspense } from "react"
import { ServiceFormPage } from "@/components/features/services/service-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateServicePage() {
  return (
    <PermissionGuard module="service" action="create">
      <Suspense>
        <ServiceFormPage mode="create" />
      </Suspense>
    </PermissionGuard>
  )
}
