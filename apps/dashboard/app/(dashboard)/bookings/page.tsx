"use client"

import { Suspense } from "react"
import { BookingsPageContent } from "@/components/features/bookings/bookings-page-content"

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsPageContent />
    </Suspense>
  )
}
