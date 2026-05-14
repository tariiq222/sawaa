"use client"

import type { ReactNode } from "react"

/**
 * Employee Profile — Shared helper components
 * (InfoRow, PricingRow, ProfileSkeleton, ContactCard, ProfessionalCard, PricingCard)
 */

import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  UserIcon,
  Mail01Icon,
  SmartPhone01Icon,
  Stethoscope02Icon,
  GraduateMaleIcon,
  BookOpen01Icon,
  Building04Icon,
  CallIcon,
  Video01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { ListPageShell } from "@/components/features/list-page-shell"
import { useLocale } from "@/components/locale-provider"
import { Skeleton } from "@deqah/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@deqah/ui"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { formatLocaleDate } from "@/lib/date"
import { sarToHalalas } from "@/lib/money"

/* ─── ProfileSkeleton ─── */

export function ProfileSkeleton() {
  return (
    <ListPageShell>
      <Breadcrumbs />
      <Skeleton className="h-16 w-80 rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`skeleton-${i}`} className="h-[130px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`skeleton-wide-${i}`} className="h-[180px] rounded-xl" />
        ))}
      </div>
    </ListPageShell>
  )
}

/* ─── InfoRow ─── */

interface InfoRowProps {
  icon: IconSvgElement
  label: string
  value: string
  numeric?: boolean
}

export function InfoRow({ icon, label, value, numeric }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-muted">
        <HugeiconsIcon icon={icon} size={14} className="text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={`text-sm font-medium text-foreground ${numeric ? "tabular-nums" : ""}`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

/* ─── PricingRow ─── */

interface PricingRowProps {
  icon: IconSvgElement
  label: string
  value: ReactNode
  color: string
  bg: string
}

export function PricingRow({ icon, label, value, color, bg }: PricingRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/40 p-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex size-8 items-center justify-center rounded-md ${bg}`}>
          <HugeiconsIcon icon={icon} size={15} className={color} />
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  )
}

/* ─── CombinedInfoCard — Contact + Professional + Account ─── */

interface CombinedInfoCardProps {
  email: string
  phone: string | null
  specialty: string
  experience: number | null
  education: string | null
  createdAt: string
  updatedAt: string
  locale: string
  /** @deprecated unused — component uses useLocale() internally */
  isAr?: boolean
}

export function CombinedInfoCard({
  email, phone, specialty, experience, education,
  createdAt, updatedAt, locale,
}: CombinedInfoCardProps) {
  const { t } = useLocale()
  return (
    <Card>
      <CardContent className="flex flex-col gap-0 divide-y divide-border p-0">

        {/* Contact */}
        <div className="flex flex-col gap-3 p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
              <HugeiconsIcon icon={UserIcon} size={13} className="text-primary" />
            </div>
            {t("employees.detail.contactInfo")}
          </span>
          <InfoRow icon={Mail01Icon} label={t("employees.detail.email")} value={email ?? "—"} />
          <InfoRow icon={SmartPhone01Icon} label={t("employees.detail.phone")} value={phone ?? "—"} numeric />
        </div>

        {/* Professional */}
        <div className="flex flex-col gap-3 p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <div className="flex size-6 items-center justify-center rounded-md bg-accent/10">
              <HugeiconsIcon icon={Stethoscope02Icon} size={13} className="text-accent" />
            </div>
            {t("employees.detail.professional")}
          </span>
          <InfoRow icon={Stethoscope02Icon} label={t("employees.detail.specialty")} value={specialty ?? "—"} />
          <InfoRow
            icon={BookOpen01Icon}
            label={t("employees.detail.experience")}
            value={experience != null ? `${experience} ${t("employees.detail.experienceYrs")}` : "—"}
            numeric
          />
          <InfoRow icon={GraduateMaleIcon} label={t("employees.detail.education")} value={education ?? "—"} />
        </div>

        {/* Account */}
        <div className="flex flex-col gap-3 p-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <div className="flex size-6 items-center justify-center rounded-md bg-surface-muted">
              <HugeiconsIcon icon={Calendar03Icon} size={13} className="text-muted-foreground" />
            </div>
            {t("employees.detail.accountInfo")}
          </span>
          <InfoRow
            icon={Calendar03Icon}
            label={t("employees.detail.registered")}
            value={formatLocaleDate(createdAt, locale)}
            numeric
          />
          <InfoRow
            icon={Calendar03Icon}
            label={t("employees.detail.lastUpdated")}
            value={formatLocaleDate(updatedAt, locale)}
            numeric
          />
        </div>

      </CardContent>
    </Card>
  )
}

/* ─── PricingCard ─── */

interface PricingCardProps {
  priceClinic: number | null
  pricePhone: number | null
  priceVideo: number | null
  locale: string
  /** @deprecated unused — component uses useLocale() internally */
  isAr?: boolean
}
export function PricingCard({ priceClinic, pricePhone, priceVideo, locale }: PricingCardProps) {
  const { t } = useLocale()
  const loc = locale === "ar" ? "ar" : "en"
  // priceClinic/Phone/Video are stored in SAR (not halalas) on the employee
  // record — promote to halalas via sarToHalalas() so FormattedCurrency
  // (halalas-native) renders correctly.
  const fmt = (v: number | null) => v != null
    ? <FormattedCurrency amount={sarToHalalas(v)} locale={loc} decimals={2} />
    : "—"
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div className="flex size-7 items-center justify-center rounded-md bg-success/10">
            <HugeiconsIcon icon={Building04Icon} size={16} className="text-success" />
          </div>
          {t("employees.detail.pricing")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <PricingRow icon={Building04Icon} label={t("employees.detail.clinicVisit")} value={fmt(priceClinic)} color="text-primary" bg="bg-primary/10" />
        <PricingRow icon={CallIcon} label={t("employees.detail.phoneConsultation")} value={fmt(pricePhone)} color="text-success" bg="bg-success/10" />
        <PricingRow icon={Video01Icon} label={t("employees.detail.videoConsultation")} value={fmt(priceVideo)} color="text-info" bg="bg-info/10" />
      </CardContent>
    </Card>
  )
}
