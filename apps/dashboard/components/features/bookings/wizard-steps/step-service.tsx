"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Stethoscope02Icon } from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServices } from "@/lib/api/services"
import type { Service } from "@/lib/types/service"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/money"

/* ─── Meta text builder ─── */

function buildMeta(service: Service, t: (key: string) => string): string {
  const parts: string[] = []

  // Duration
  if (!service.hideDurationOnBooking) {
    parts.push(
      `${service.durationMins} ${t("bookings.wizard.step.typeDuration.minutes")}`
    )
  }

  // Price — runtime convention is halalas-as-Decimal (see docs/superpowers/
  // tech-debt/price-units-*). Use formatPrice() to convert/format so this
  // dialog matches the /services list and service-columns. The eventual
  // halalas↔SAR unification migration (owner-only — payments) will
  // only need to update lib/money.ts.
  if (!service.hidePriceOnBooking) {
    const currency = t("bookings.wizard.step.service.currency")
    parts.push(`${formatPrice(Number(service.price))} ${currency}`)
  }

  return parts.join(" · ")
}

/* ─── Skeleton ─── */

function StepServiceSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ─── Step component ─── */

interface StepServiceProps {
  onSelect: (serviceId: string, serviceName: string) => void
}

export function StepService({ onSelect }: StepServiceProps) {
  const { t, locale } = useLocale()
  const isRtl = locale === "ar"
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchServices({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  const services = useMemo(() => {
    const all = data?.items ?? []
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(q) ||
        (s.nameEn ?? "").toLowerCase().includes(q)
    )
  }, [data, search])

  if (isLoading) return <StepServiceSkeleton />

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
            isRtl ? "inset-e-4" : "inset-s-4"
          )}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("bookings.wizard.step.service.search")}
          className={cn(
            "h-12 w-full rounded-2xl border border-border bg-surface text-sm text-foreground",
            "outline-none placeholder:text-muted-foreground",
            "transition-all focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
            isRtl ? "ps-4 pe-12" : "ps-12 pe-4"
          )}
        />
      </div>

      {/* Service list */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {services.map((service) => {
          const name =
            locale === "ar"
              ? service.nameAr
              : (service.nameEn ?? service.nameAr)
          const meta = buildMeta(service, t)

          return (
            <WizardCard
              key={service.id}
              onClick={() => onSelect(service.id, name)}
              className="px-4 py-3.5"
            >
              <div className="flex items-center gap-3 text-start">
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: service.iconBgColor
                      ? `${service.iconBgColor}20`
                      : "hsl(var(--primary) / 0.12)",
                  }}
                >
                  <HugeiconsIcon
                    icon={Stethoscope02Icon}
                    size={18}
                    style={{ color: service.iconBgColor ?? "hsl(var(--primary))" }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {name}
                  </span>
                  {meta && (
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {meta}
                    </span>
                  )}
                </div>
              </div>
            </WizardCard>
          )
        })}
      </div>
    </div>
  )
}
