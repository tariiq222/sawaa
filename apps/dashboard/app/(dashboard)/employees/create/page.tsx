import { EmployeeFormPage } from "@/components/features/employees/employee-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateEmployeePage() {
  return (
    <PermissionGuard module="employee" action="create">
      <EmployeeFormPage mode="create" />
    </PermissionGuard>
  )
}
