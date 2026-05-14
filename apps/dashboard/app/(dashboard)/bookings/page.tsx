"use client"

import { Suspense } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingSettings } from "@/lib/api/booking-settings"
import { BookingsPageContent } from "@/components/features/bookings/bookings-page-content"

export default function BookingsPage() {
  const { data: bookingSettings } = useQuery({
    queryKey: queryKeys.bookingSettings.detail(),
    queryFn: fetchBookingSettings,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <Suspense>
      <BookingsPageContent bookingSettings={bookingSettings ?? null} />
    </Suspense>
  )
}
