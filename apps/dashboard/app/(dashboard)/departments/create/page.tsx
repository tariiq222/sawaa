import { DepartmentFormPage } from "@/components/features/departments/department-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateDepartmentPage() {
  return (
    <PermissionGuard module="department" action="create">
      <DepartmentFormPage mode="create" />
    </PermissionGuard>
  )
}
