"use client"

import { BranchListPage } from "@/components/features/branches/branch-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function BranchesRoute() {
  return (
    <PermissionGuard module="branch" action="read">
      <BranchListPage />
    </PermissionGuard>
  )
}
