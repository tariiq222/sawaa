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
} from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { ar } from "date-fns/locale"
import { formatDatePattern } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { Service } from "@/lib/types/service"
import { ServiceAvatar } from "./service-avatar"

/* ─── Sub-components ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
      {children}
    </p>
  )
}

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-words">
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  )
}

function StatusPill({ active, yes, no }: { active: boolean; yes: string; no: string }) {
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
      <DialogContent className="max-w-lg">
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

        <div className="overflow-y-auto max-h-[calc(80dvh-8rem)] px-6 py-5 flex flex-col gap-5">

          {/* Status row */}
          <div className="flex flex-wrap gap-2">
            <StatusPill
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

          <Separator />

          {/* Basic info */}
          <div>
            <SectionLabel>{t("services.create.tabs.basic")}</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label={t("services.detail.nameEn")} value={service.nameEn} />
              <Field label={t("services.detail.nameAr")} value={service.nameAr} />
              {(service.descriptionEn || service.descriptionAr) && (
                <>
                  <Field label={t("services.detail.descEn")} value={service.descriptionEn} />
                  <Field
                    label={t("services.detail.descAr")}
                    value={service.descriptionAr ? <span dir="rtl">{service.descriptionAr}</span> : null}
                  />
                </>
              )}
              <Field
                label={t("services.detail.category")}
                value={service.category ? (isAr ? service.category.nameAr : service.category.nameEn) : null}
                className="col-span-2"
              />
            </div>
          </div>

          <Separator />

          {/* Pricing */}
          <div>
            <SectionLabel>{t("services.create.tabs.pricing")}</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field
                label={t("services.detail.price")}
                value={<span className="tabular-nums">{(service.price / 100).toFixed(2)} {t("services.bookingTypes.priceCurrency")}</span>}
              />
              <Field
                label={t("services.detail.duration")}
                value={<span className="tabular-nums">{service.durationMins} {t("services.detail.min")}</span>}
              />
            </div>
          </div>

          <Separator />

          {/* Booking settings */}
          <div>
            <SectionLabel>{t("services.detail.bookingSettings")}</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field
                label={t("services.detail.deposit")}
                value={
                  service.depositEnabled
                    ? <span className="tabular-nums">{service.depositAmount != null ? Number(service.depositAmount).toFixed(2) : "—"}</span>
                    : <StatusPill active={false} yes="" no={t("common.disabled")} />
                }
              />
              <Field
                label={t("services.detail.recurring")}
                value={
                  <StatusPill
                    active={service.allowRecurring}
                    yes={t("common.enabled")}
                    no={t("common.disabled")}
                  />
                }
              />
              {service.bufferMinutes > 0 && (
                <Field
                  label={t("services.detail.buffer")}
                  value={<span className="tabular-nums">{service.bufferMinutes} {t("services.detail.min")}</span>}
                />
              )}
              {service.minLeadMinutes != null && (
                <Field
                  label={t("services.detail.minLead")}
                  value={<span className="tabular-nums">{service.minLeadMinutes} {t("services.detail.min")}</span>}
                />
              )}
              {service.maxAdvanceDays != null && (
                <Field
                  label={t("services.detail.maxAdvance")}
                  value={<span className="tabular-nums">{service.maxAdvanceDays} {t("services.booking.days")}</span>}
                />
              )}
              {service.maxParticipants > 1 && (
                <Field
                  label={t("services.detail.maxParticipants")}
                  value={<span className="tabular-nums">{service.maxParticipants}</span>}
                />
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="flex flex-col gap-3">
            <SectionLabel>{t("services.detail.dates")}</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field
              label={t("services.detail.created")}
              value={
                <span className="tabular-nums text-muted-foreground">
                  {formatDatePattern(service.createdAt, "PP", { locale: dateFnsLocale })}
                </span>
              }
            />
            <Field
              label={t("services.detail.updated")}
              value={
                <span className="tabular-nums text-muted-foreground">
                  {formatDatePattern(service.updatedAt, "PP", { locale: dateFnsLocale })}
                </span>
              }
            />
            </div>
          </div>

        </div>

        <DialogFooter>
          {onEdit && (
            <Button
              size="sm"
              className="gap-1.5"
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
