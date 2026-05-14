"use client"

import { useParams } from "next/navigation"
import { EmployeeDetailPage } from "@/components/features/employees/employee-detail-page"

export default function EmployeeDetailRoute() {
  const { id } = useParams<{ id: string }>()
  return <EmployeeDetailPage employeeId={id} />
}
