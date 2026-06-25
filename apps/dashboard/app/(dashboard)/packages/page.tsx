"use client"

import { PackageListPage } from "@/components/features/packages/package-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function PackagesRoute() {
  return (
    <PermissionGuard module="service" action="read">
      <PackageListPage />
    </PermissionGuard>
  )
}
