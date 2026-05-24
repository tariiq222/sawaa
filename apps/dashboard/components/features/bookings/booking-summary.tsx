"use client"

import { Button, Input } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { FormattedCurrency } from "@/components/features/shared/sar-symbol"
import { cn } from "@/lib/utils"

/* ─── Props ─── */

interface BookingSummaryProps {
  clientName: string | null
  serviceName: string | null
  employeeName: string | null
  type: string | null
  durationLabel: string | null
  date: string | null
  startTime: string | null
  /** Selected service price in halalas (1 SAR = 100). */
  servicePriceHalalas: number | null
  payAtClinic: boolean
  couponCode: string | null
  submitting: boolean
  isComplete: boolean
  onTogglePayAtClinic: (value: boolean) => void
  onCouponChange: (code: string | null) => void
  onSubmit: () => void
}

/* ─── Type label helper ─── */

function getTypeLabel(type: string | null, t: (key: string) => string): string | null {
  if (!type) return null
  const map: Record<string, string> = {
    in_person: t("bookings.wizard.step.typeDuration.inPerson"),
    online: t("bookings.wizard.step.typeDuration.online"),
    walk_in: t("bookings.wizard.step.typeDuration.walkIn"),
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
    WALK_IN: t("bookings.wizard.step.typeDuration.walkIn"),
  }
  return map[type] ?? map[type.toLowerCase()] ?? type
}

/* ─── Summary row ─── */

interface SummaryRowProps {
  label: string
  value: string | null
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-end text-sm",
          value
            ? "font-medium text-foreground"
            : "text-muted-foreground opacity-50",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  )
}

/* ─── Pay at clinic option ─── */

interface PayAtClinicOptionProps {
  selected: boolean
  label: string
  description: string
  onSelect: () => void
}

function PayAtClinicOption({ selected, label, description, onSelect }: PayAtClinicOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-4 text-start transition-all",
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface hover:bg-muted/50",
      )}
    >
      {/* Radio indicator */}
      <div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          selected ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {selected && <div className="size-2.5 rounded-full bg-primary" />}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </button>
  )
}

/* ─── Main component ─── */

export function BookingSummary({
  clientName,
  serviceName,
  employeeName,
  type,
  durationLabel,
  date,
  startTime,
  servicePriceHalalas,
  payAtClinic,
  couponCode,
  submitting,
  isComplete,
  onTogglePayAtClinic,
  onCouponChange,
  onSubmit,
}: BookingSummaryProps) {
  const { t, locale } = useLocale()
  const { formatDate, formatTime } = useOrganizationConfig()

  // Type + duration combined value
  const typeLabel = getTypeLabel(type, t)
  const typeDurationValue = [typeLabel, durationLabel ?? null]
    .filter(Boolean)
    .join(" · ") || null

  // Date + time combined value
  const dateLabel = date ? formatDate(date + "T00:00:00") : null
  const datetimeValue =
    dateLabel && startTime
      ? `${dateLabel} · ${formatTime(startTime)}`
      : dateLabel ?? null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:sticky md:top-6">
      {/* Title */}
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("bookings.pos.summary.title")}
      </h2>

      {/* Summary rows */}
      <dl className="flex flex-col gap-3">
        <SummaryRow
          label={t("bookings.wizard.step.confirm.client")}
          value={clientName}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.service")}
          value={serviceName}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.employee")}
          value={employeeName}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.type")}
          value={typeDurationValue}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.datetime")}
          value={datetimeValue}
        />
      </dl>

      <hr className="border-border" />

      {/* Service price */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t("bookings.pos.summary.servicePrice")}
        </span>
        {servicePriceHalalas != null ? (
          <FormattedCurrency
            amount={servicePriceHalalas}
            locale={locale}
            decimals={2}
            className="text-base font-semibold tabular-nums text-foreground"
          />
        ) : (
          <span className="text-sm text-muted-foreground opacity-50">—</span>
        )}
      </div>

      <hr className="border-border" />

      {/* Pay at clinic */}
      <PayAtClinicOption
        selected={payAtClinic}
        label={t("bookings.wizard.step.confirm.payAtClinic")}
        description={t("bookings.wizard.step.confirm.payAtClinicDescription")}
        onSelect={() => onTogglePayAtClinic(!payAtClinic)}
      />

      {/* Coupon code */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("bookings.wizard.step.confirm.couponHeader")}
        </p>
        <Input
          placeholder={t("bookings.wizard.step.confirm.couponPlaceholder")}
          value={couponCode ?? ""}
          onChange={(e) => onCouponChange(e.target.value || null)}
          className="bg-surface"
        />
      </div>

      {/* Submit button */}
      <Button
        className="w-full"
        size="lg"
        onClick={onSubmit}
        disabled={!isComplete || submitting}
        type="button"
      >
        {t("bookings.pos.confirm")}
      </Button>
      {!isComplete && (
        <p className="text-center text-xs text-muted-foreground">
          {(() => {
            const missing: string[] = []
            if (!clientName) missing.push(t("bookings.pos.section.client"))
            if (!serviceName) missing.push(t("bookings.pos.section.service"))
            if (!employeeName) missing.push(t("bookings.pos.section.employee"))
            if (!type) missing.push(t("bookings.pos.section.typeDuration"))
            if (!date || !startTime) missing.push(t("bookings.pos.section.datetime"))
            return `${t("bookings.pos.missingPrefix")}: ${missing.join("، ")}`
          })()}
        </p>
      )}
    </div>
  )
}
