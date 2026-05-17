"use client"

import { PaymentListPage } from "@/components/features/payments/payment-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function PaymentsRoute() {
  return (
    <PermissionGuard module="payment" action="read">
      <PaymentListPage />
    </PermissionGuard>
  )
}
