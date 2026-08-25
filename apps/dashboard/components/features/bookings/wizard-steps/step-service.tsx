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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ─── Step component ─── */

interface StepServiceProps {
  categoryId: string
  onSelect: (serviceId: string, serviceName: string) => void
  /**
   * W2B-T8 — optional FLEXIBLE-credit gate. When provided, services
   * whose id fails the predicate are HIDDEN from the rendered grid
   * (not merely disabled) so the operator sees only what the package
   * permits. Default behaviour — render every service — is preserved
   * exactly when the prop is omitted.
   */
  isServiceAllowed?: (serviceId: string) => boolean
}

export function StepService({
  categoryId,
  onSelect,
  isServiceAllowed,
}: StepServiceProps) {
  const { t, locale } = useLocale()
  const isRtl = locale === "ar"
  const [search, setSearch] = useState("")

  const filters = { isActive: true, limit: 100, categoryId }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list(filters),
    queryFn: () => fetchServices(filters),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  })

  // Two-stage narrowing — predicate (OUTER) then search (INNER) — so
  // typing can never resurrect a service the package rejects, and a
  // missed search never gets mis-reported as "the package allows
  // nothing". `allowedServices` is independent of `search`; `services`
  // is `allowedServices` further narrowed by the free-text query.
  // W5-T17 — `data` is a stable useQuery result reference, so the
  // `?? []` fallback is moved inside the memo to keep the dep array
  // stable across renders (the lint warning flagged a fresh `all`
  // identity per render defeating the memo).
  const allowedServices = useMemo(
    () => {
      const all = data?.items ?? []
      return isServiceAllowed ? all.filter((s) => isServiceAllowed(s.id)) : all
    },
    [data, isServiceAllowed]
  )
  const services = useMemo(() => {
    const q = search.trim()
    if (!q) return allowedServices
    const needle = q.toLowerCase()
    return allowedServices.filter(
      (s) =>
        s.nameAr.toLowerCase().includes(needle) ||
        (s.nameEn ?? "").toLowerCase().includes(needle)
    )
  }, [allowedServices, search])

  if (isLoading) return <StepServiceSkeleton />

  // Package-empty: predicate present AND it permits zero services in
  // this category. The package genuinely allows nothing here, so
  // omitting the search input is correct — searching an empty set is
  // pointless.
  if (allowedServices.length === 0 && isServiceAllowed) {
    return (
      <p
        data-testid="step-service-empty"
        className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground"
      >
        {t("bookings.pos.package.filter.noOptions")}
      </p>
    )
  }

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const name =
            locale === "ar"
              ? service.nameAr
              : (service.nameEn ?? service.nameAr)
          const meta = buildMeta(service, t)
          // No active practitioner offers this service ⇒ unbookable.
          const isEmpty = service.employeeCount === 0

          return (
            <WizardCard
              key={service.id}
              onClick={() => onSelect(service.id, name)}
              disabled={isEmpty}
              disabledReason={t("bookings.pos.disabled.service")}
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

        {/* Search-empty: a predicate is active and allowed at least one
            service in this category, but the typed query matched none.
            We keep the search input mounted above so the operator can
            edit or clear the query — this is the bug the fix targets. */}
        {isServiceAllowed && services.length === 0 && (
          <p
            data-testid="step-service-no-results"
            className="col-span-full rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground"
          >
            {t("bookings.client.search.noResults")}
          </p>
        )}
      </div>
    </div>
  )
}
