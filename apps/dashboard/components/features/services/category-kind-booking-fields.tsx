"use client"

import { FormSection } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import { RadioGroup, RadioGroupItem } from "@sawaa/ui"

type CategoryKind = "CLINIC" | "SERVICE_GROUP"
type BookingMode = "DIRECT" | "SERVICES"

export function resolveEffectiveCategoryKind(
  mode: "create" | "edit",
  watchedKind?: CategoryKind,
  savedKind?: CategoryKind,
): CategoryKind {
  if (mode === "edit") return watchedKind ?? savedKind ?? "CLINIC"
  return watchedKind ?? "CLINIC"
}

interface CategoryKindBookingFieldsProps {
  kind: CategoryKind
  bookingMode: BookingMode
  mode: "create" | "edit"
  onKindChange: (kind: CategoryKind) => void
  onBookingModeChange: (bookingMode: BookingMode) => void
}

export function CategoryKindBookingFields({
  kind,
  bookingMode,
  mode,
  onKindChange,
  onBookingModeChange,
}: CategoryKindBookingFieldsProps) {
  const { t } = useLocale()
  // Category kind and booking mode follow the immutable-mode contract.
  // See docs/architecture/clinic-service-booking-contract.md.
  return (
    <>
      <FormSection title={t("services.categories.kind.label")}>
        <RadioGroup
          value={kind}
          onValueChange={(value: CategoryKind) => {
            onKindChange(value)
            if (mode === "create" && value === "SERVICE_GROUP") onBookingModeChange("SERVICES")
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {(["CLINIC", "SERVICE_GROUP"] as const).map((option) => {
            const unavailable = mode === "edit" && option === "SERVICE_GROUP" && bookingMode === "DIRECT"
            const labelKey = option === "CLINIC" ? "clinic" : "group"
            return (
              <label key={option} htmlFor={`page-kind-${option.toLowerCase()}`} className={`flex items-start gap-3 rounded-sm border border-border bg-surface p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-muted/40 ${unavailable ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <RadioGroupItem value={option} id={`page-kind-${option.toLowerCase()}`} className="mt-0.5" disabled={unavailable} />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{t(`services.categories.kind.${labelKey}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`services.categories.kind.${labelKey}Desc`)}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
      </FormSection>

      <FormSection title={t("services.categories.bookingMode.label")}>
        <RadioGroup
          value={bookingMode}
          onValueChange={(value: BookingMode) => onBookingModeChange(value)}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {(["DIRECT", "SERVICES"] as const).map((option) => {
            const optionLabel = option === "DIRECT" ? "direct" : "services"
            const disabled = mode === "edit" || kind === "SERVICE_GROUP"
            return (
              <label key={option} htmlFor={`page-mode-${option.toLowerCase()}`} className={`flex items-start gap-3 rounded-sm border border-border bg-surface p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-surface-muted/40 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <RadioGroupItem value={option} id={`page-mode-${option.toLowerCase()}`} className="mt-0.5" disabled={disabled} />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{t(`services.categories.bookingMode.${optionLabel}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`services.categories.bookingMode.${optionLabel}Desc`)}</span>
                </span>
              </label>
            )
          })}
        </RadioGroup>
        {(mode === "edit" || kind === "SERVICE_GROUP") && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t(kind === "SERVICE_GROUP" ? "services.categories.kind.groupModeHint" : "services.categories.bookingMode.editHint")}
          </p>
        )}
      </FormSection>
    </>
  )
}
