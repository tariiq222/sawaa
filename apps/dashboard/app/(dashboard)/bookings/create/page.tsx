"use client"

import { useRouter } from "next/navigation"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { BookingWizard } from "@/components/features/bookings/booking-wizard"
import { useLocale } from "@/components/locale-provider"

export default function CreateBookingPage() {
  const router = useRouter()
  const { t } = useLocale()

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader
        title={t("bookings.create.pageTitle")}
        description={t("bookings.create.pageDescription")}
      />

      <div className="mx-auto w-full max-w-2xl">
        <BookingWizard
          onSuccess={() => router.push("/bookings")}
          onClose={() => router.push("/bookings")}
        />
      </div>
    </ListPageShell>
  )
}
