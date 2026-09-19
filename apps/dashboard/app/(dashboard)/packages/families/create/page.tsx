import { PermissionGuard } from "@/components/features/permission-guard"
import { PackageFamilyFormPage } from "@/components/features/packages/package-family-form-page"

export default function CreatePackageFamilyPage() {
  return <PermissionGuard module="service" action="create"><PackageFamilyFormPage mode="create" /></PermissionGuard>
}
