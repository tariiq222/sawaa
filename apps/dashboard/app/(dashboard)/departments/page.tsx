"use client"

import { DepartmentListPage } from "@/components/features/departments/department-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function DepartmentsRoute() {
  return (
    <PermissionGuard module="department" action="read">
      <DepartmentListPage />
    </PermissionGuard>
  )
}
