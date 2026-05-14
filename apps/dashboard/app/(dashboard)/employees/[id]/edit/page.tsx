"use client"

import { useParams } from "next/navigation"
import { EmployeeFormPage } from "@/components/features/employees/employee-form-page"

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  return <EmployeeFormPage mode="edit" employeeId={id} />
}
