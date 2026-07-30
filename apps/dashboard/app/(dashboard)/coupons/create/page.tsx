import { CouponFormPage } from "@/components/features/coupons/coupon-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateCouponPage() {
  return (
    <PermissionGuard module="coupon" action="create">
      <CouponFormPage mode="create" />
    </PermissionGuard>
  )
}
