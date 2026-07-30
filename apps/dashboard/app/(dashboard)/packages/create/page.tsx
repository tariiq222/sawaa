import { PackageFormPage } from "@/components/features/packages/package-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreatePackagePage() {
  return (
    <PermissionGuard module="service" action="create">
      <PackageFormPage mode="create" />
    </PermissionGuard>
  )
}
