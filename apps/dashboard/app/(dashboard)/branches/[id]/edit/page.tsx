"use client"

import { useParams } from "next/navigation"
import { BranchFormPage } from "@/components/features/branches/branch-form-page"

export default function EditBranchPage() {
  const { id } = useParams<{ id: string }>()
  return <BranchFormPage mode="edit" branchId={id} />
}
