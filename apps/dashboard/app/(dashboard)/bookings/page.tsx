"use client"

import { Suspense } from "react"
import { BookingsPageContent } from "@/components/features/bookings/bookings-page-content"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function BookingsPage() {
  return (
    <PermissionGuard module="booking" action="read">
      <Suspense>
        <BookingsPageContent />
      </Suspense>
    </PermissionGuard>
  )
}
