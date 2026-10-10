"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"

interface GreetingHeaderProps {
  userName: string
  dateLabel: string
  bookingsCount: number
}

function getGreeting(t: (key: string) => string): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Riyadh",hour:"numeric",hourCycle:"h23"}).format(new Date()))
  if (hour < 12) return t("dashboard.goodMorning")
  if (hour < 18) return t("dashboard.goodAfternoon")
  return t("dashboard.goodEvening")
}

export function GreetingHeader({ userName, dateLabel, bookingsCount }: GreetingHeaderProps) {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const greeting = getGreeting(t)

  const safeCount = Number.isFinite(bookingsCount) && bookingsCount >= 0 ? bookingsCount : 0
  const summary = t("dashboard.greeting.summary").replace("{count}", String(safeCount))

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-[64ch]">
        <h1 className="truncate text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {t("dashboard.greeting.hello")
            .replace("{greeting}", greeting)
            .replace("{name}", userName)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span>{dateLabel}</span>
          <span className="mx-2 text-muted-foreground/60" aria-hidden>
            ·
          </span>
          <span className="font-medium text-foreground/80">{summary}</span>
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={16}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <button type="button" aria-label={t("header.search")} onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", {key:"k",metaKey:true,bubbles:true}))} className="h-10 w-full max-w-[260px] rounded-lg border border-border bg-surface ps-10 pe-4 text-sm text-muted-foreground">
            {t("header.search")}
          </button>
        </div>

        {canDo("booking", "create") && <Button asChild size="default" className="h-10 gap-2 rounded-lg px-5">
          <Link href="/bookings?new=1">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            <span>{t("actions.newBooking")}</span>
          </Link>
        </Button>}
      </div>
    </div>
  )
}
