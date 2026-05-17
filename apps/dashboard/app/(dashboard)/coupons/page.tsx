"use client"

import { CouponListPage } from "@/components/features/coupons/coupon-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CouponsRoute() {
  return (
    <PermissionGuard module="coupon" action="read">
      <CouponListPage />
    </PermissionGuard>
  )
}
