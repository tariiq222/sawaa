"use client"

import { useParams } from "next/navigation"
import { DepartmentFormPage } from "@/components/features/departments/department-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditDepartmentPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="department" action="update">
      <DepartmentFormPage mode="edit" departmentId={id} />
    </PermissionGuard>
  )
}
