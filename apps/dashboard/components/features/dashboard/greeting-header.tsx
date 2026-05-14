"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Add01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"

interface GreetingHeaderProps {
  userName: string
  dateLabel: string
  bookingsCount: number
}

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours()
  if (hour < 12) return t("dashboard.goodMorning")
  if (hour < 18) return t("dashboard.goodAfternoon")
  return t("dashboard.goodEvening")
}

export function GreetingHeader({
  userName,
  dateLabel,
  bookingsCount,
}: GreetingHeaderProps) {
  const { t } = useLocale()
  const greeting = getGreeting(t)

  const safeCount = Number.isFinite(bookingsCount) && bookingsCount >= 0 ? bookingsCount : 0
  const subtitle = `${dateLabel} — ${t("dashboard.greeting.summary").replace("{count}", String(safeCount))}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold text-foreground">
          {t("dashboard.greeting.hello").replace("{greeting}", greeting).replace("{name}", userName)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={18}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder={t("header.search")}
            aria-label={t("header.search")}
            className="h-10 w-full max-w-[260px] rounded-full ps-10"
          />
        </div>

        {/* New booking */}
        <Button asChild className="gap-2 rounded-full">
          <Link href="/bookings">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            <span>{t("actions.newBooking")}</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
