"use client"

import { useParams } from "next/navigation"
import { CouponFormPage } from "@/components/features/coupons/coupon-form-page"

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>()
  return <CouponFormPage mode="edit" couponId={id} />
}
