"use client"

import { useParams } from "next/navigation"
import { CouponFormPage } from "@/components/features/coupons/coupon-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="coupon" action="update">
      <CouponFormPage mode="edit" couponId={id} />
    </PermissionGuard>
  )
}
