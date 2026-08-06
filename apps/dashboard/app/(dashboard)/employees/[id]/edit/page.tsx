"use client"

import { useParams } from "next/navigation"
import { EmployeeFormPage } from "@/components/features/employees/employee-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="employee" action="update">
      <EmployeeFormPage mode="edit" employeeId={id} />
    </PermissionGuard>
  )
}
