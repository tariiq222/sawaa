"use client"

import { BundleListPage } from "@/components/features/bundles/bundle-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function BundlesRoute() {
  return (
    <PermissionGuard module="service" action="read">
      <BundleListPage />
    </PermissionGuard>
  )
}
