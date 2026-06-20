"use client"

import { useParams } from "next/navigation"
import { DepartmentFormPage } from "@/components/features/departments/department-form-page"

export default function EditDepartmentPage() {
  const { id } = useParams<{ id: string }>()
  return <DepartmentFormPage mode="edit" departmentId={id} />
}
