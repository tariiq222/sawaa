"use client"

import { useParams } from "next/navigation"
import { EmployeeDetailPage } from "@/components/features/employees/employee-detail-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EmployeeDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="employee" action="read">
      <EmployeeDetailPage employeeId={id} />
    </PermissionGuard>
  )
}
