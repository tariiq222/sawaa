import { UserIcon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@deqah/ui"
import { BookingTypeBadge } from "@/components/features/status-badge"
import { SectionHeader } from "@/components/features/section-header"
import { useLocale } from "@/components/locale-provider"
import type { Booking } from "@/lib/types/booking"

interface BookingInfoCardProps {
  booking: Booking
}

export function BookingInfoCard({ booking }: BookingInfoCardProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  const clientName = booking.client
    ? `${booking.client.firstName} ${booking.client.lastName}`
    : "—"

  const employeeName = booking.employee?.user
    ? `${t("bookings.info.drPrefix")} ${booking.employee.user.firstName} ${booking.employee.user.lastName}`
    : "—"

  const serviceName = isAr ? booking.service?.nameAr : booking.service?.nameEn

  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader
          icon={UserIcon}
          title={t("bookings.info.title")}
          description={t("bookings.info.description")}
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("bookings.info.client")}</span>
            <span className="text-sm font-medium text-foreground">{clientName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("bookings.info.employee")}</span>
            <span className="text-sm font-medium text-foreground">{employeeName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("bookings.info.service")}</span>
            <span className="text-sm font-medium text-foreground">{serviceName ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t("bookings.info.type")}</span>
            <BookingTypeBadge type={booking.type} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
