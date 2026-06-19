"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { DetailSection, DetailRow } from "@/components/features/detail-sheet-parts"
import { useLocale } from "@/components/locale-provider"
import { ar } from "date-fns/locale"
import { formatDatePattern } from "@/lib/date"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/money"
import type { Service } from "@/lib/types/service"
import { ServiceAvatar } from "./service-avatar"

/* ─── Sub-components ─── */

/** Stacked field for long-form text (descriptions) that needs the full width.
 *  DetailRow does not support stacked layout — kept as a local helper. */
function StackedField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium leading-relaxed text-foreground break-words">
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  )
}

/** Shared status badge — mirrors the badge pattern in service-columns. */
export function ServiceStatusBadge({ active, yes, no }: { active: boolean; yes: string; no: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        active
          ? "border-success/30 bg-success/10 text-success"
          : "border-muted-foreground/20 bg-muted text-muted-foreground",
      )}
    >
      {active ? yes : no}
    </Badge>
  )
}

/* ─── Props ─── */

interface ServiceDetailSheetProps {
  service: Service | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (s: Service) => void
}

/* ─── Component ─── */

export function ServiceDetailSheet({
  service,
  open,
  onOpenChange,
  onEdit,
}: ServiceDetailSheetProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const dateFnsLocale = isAr ? ar : undefined

  if (!service) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start gap-3 pe-6">
            <ServiceAvatar
              iconName={service.iconName}
              iconBgColor={service.iconBgColor}
              imageUrl={service.imageUrl}
              name={isAr ? service.nameAr : (service.nameEn ?? undefined)}
              size="md"
            />
            <div className="flex flex-col gap-1 min-w-0">
              <DialogTitle className="leading-snug">
                {isAr ? service.nameAr : service.nameEn}
              </DialogTitle>
              <DialogDescription>{t("services.detail.title")}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(80dvh-8rem)] px-6 py-5 flex flex-col gap-4">

          {/* Status row */}
          <div className="flex flex-wrap gap-2">
            <ServiceStatusBadge
              active={service.isActive}
              yes={t("services.status.active")}
              no={t("services.status.inactive")}
            />
            {service.isHidden && (
              <Badge variant="outline" className="text-xs border-warning/30 bg-warning/10 text-warning">
                {t("services.display.hideService")}
              </Badge>
            )}
            {service.hidePriceOnBooking && (
              <Badge variant="outline" className="text-xs border-muted-foreground/20 bg-muted text-muted-foreground">
                {t("services.display.hidePrice")}
              </Badge>
            )}
            {service.hideDurationOnBooking && (
              <Badge variant="outline" className="text-xs border-muted-foreground/20 bg-muted text-muted-foreground">
                {t("services.display.hideDuration")}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">

          {/* Basic info */}
          <DetailSection title={t("services.create.tabs.basic")}>
            <div className="flex flex-col gap-1.5 py-1.5">
              <DetailRow label={t("services.detail.nameEn")} value={service.nameEn ?? "—"} />
              <DetailRow label={t("services.detail.nameAr")} value={service.nameAr} />
              <DetailRow
                label={t("services.detail.category")}
                value={service.category ? (isAr ? service.category.nameAr : (service.category.nameEn ?? service.category.nameAr)) : "—"}
              />
              {service.descriptionEn && (
                <StackedField label={t("services.detail.descEn")} value={service.descriptionEn} />
              )}
              {service.descriptionAr && (
                <StackedField
                  label={t("services.detail.descAr")}
                  value={<span dir="rtl">{service.descriptionAr}</span>}
                />
              )}
            </div>
          </DetailSection>

          {/* Pricing */}
          <DetailSection title={t("services.create.tabs.pricing")}>
            <div className="flex flex-col gap-1.5 py-1.5">
              <DetailRow
                label={t("services.detail.price")}
                value={`${formatPrice(Number(service.price))} ${t("services.bookingTypes.priceCurrency")}`}
                numeric
              />
              <DetailRow
                label={t("services.detail.duration")}
                value={`${service.durationMins} ${t("services.detail.min")}`}
                numeric
              />
            </div>
          </DetailSection>

          {/* Booking settings */}
          <DetailSection title={t("services.detail.bookingSettings")}>
            <div className="flex flex-col gap-1.5 py-1.5">
              <DetailRow
                label={t("services.detail.deposit")}
                value={
                  service.depositEnabled
                    ? `${service.depositAmount != null ? formatPrice(Number(service.depositAmount)) : "—"}`
                    : <ServiceStatusBadge active={false} yes="" no={t("common.disabled")} />
                }
                numeric={service.depositEnabled}
              />
              {service.bufferMinutes > 0 && (
                <DetailRow
                  label={t("services.detail.buffer")}
                  value={`${service.bufferMinutes} ${t("services.detail.min")}`}
                  numeric
                />
              )}
              {service.minLeadMinutes != null && (
                <DetailRow
                  label={t("services.detail.minLead")}
                  value={`${service.minLeadMinutes} ${t("services.detail.min")}`}
                  numeric
                />
              )}
              {service.maxAdvanceDays != null && (
                <DetailRow
                  label={t("services.detail.maxAdvance")}
                  value={`${service.maxAdvanceDays} ${t("services.booking.days")}`}
                  numeric
                />
              )}
              {service.maxParticipants > 1 && (
                <DetailRow
                  label={t("services.detail.maxParticipants")}
                  value={`${service.maxParticipants}`}
                  numeric
                />
              )}
            </div>
          </DetailSection>

          {/* Dates */}
          <DetailSection title={t("services.detail.dates")}>
            <div className="flex flex-col gap-1.5 py-1.5">
              <DetailRow
                label={t("services.detail.created")}
                value={formatDatePattern(service.createdAt, "PP", { locale: dateFnsLocale })}
                numeric
              />
              <DetailRow
                label={t("services.detail.updated")}
                value={formatDatePattern(service.updatedAt, "PP", { locale: dateFnsLocale })}
                numeric
              />
            </div>
          </DetailSection>

          </div>

        </div>

        <DialogFooter>
          {onEdit && (
            <Button
              size="sm"
              onClick={() => { onOpenChange(false); onEdit(service) }}
            >
              <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
              {t("services.action.edit")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
