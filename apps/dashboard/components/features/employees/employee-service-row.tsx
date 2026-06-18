"use client"

import { useState } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { ActiveCell, BufferCell } from "@/components/features/shared/inline-edit-cells"
import { formatPrice } from "@/lib/money"
import type { EmployeeService } from "@/lib/types/employee"

/* ─── Constants ─── */

const TYPE_LABEL_MAP: Record<string, string> = {
  in_person: "inPerson",
  online: "online",
  clinic_visit: "clinicVisit",
  phone_consultation: "phoneConsultation",
  video_consultation: "videoConsultation",
}

/* ─── Props ─── */

interface EmployeeServiceRowProps {
  ps: EmployeeService
  locale: string
  t: (key: string) => string
  isSaving: boolean
  onPatchBuffer: (next: number, onSettled?: () => void) => void
  onPatchActive: (next: boolean, onSettled?: () => void) => void
  onEdit: () => void
  onRemove: () => void
}

/* ─── Component ─── */

export function EmployeeServiceRow({
  ps,
  locale,
  t,
  isSaving,
  onPatchBuffer,
  onPatchActive,
  onEdit,
  onRemove,
}: EmployeeServiceRowProps) {
  /* Optimistic isActive so the Switch flips immediately on click. */
  const [optimisticIsActive, setOptimisticIsActive] = useState<
    boolean | null
  >(null)
  const clearOptimistic = () => setOptimisticIsActive(null)

  const handlePatchBuffer = (next: number) => {
    onPatchBuffer(next, clearOptimistic)
  }

  const handlePatchActive = (next: boolean) => {
    setOptimisticIsActive(next)
    onPatchActive(next, clearOptimistic)
  }

  const name = ps.service
    ? locale === "ar"
      ? ps.service.nameAr
      : ps.service.nameEn
    : t("employees.services.unknown")
  const sarUnit = t("employees.services.sar")
  const minUnit = t("employees.services.minutes")

  const typeBadges = buildTypeBadges(ps, t, sarUnit, minUnit)
  const displayedIsActive = optimisticIsActive ?? ps.isActive

  return (
    <SurfaceRow variant="default" size="sm" className="flex flex-col gap-2">
      {/* Top row: name + status switch */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <ActiveCell
          checked={displayedIsActive}
          isSaving={isSaving}
          ariaLabel={t("employees.services.inlineActiveAria")}
          onChange={handlePatchActive}
        />
      </div>

      {/* Type info pills */}
      {typeBadges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {typeBadges.map((badge) => (
            <Badge
              key={badge.type}
              variant="secondary"
              className="text-[10px] tabular-nums"
            >
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {/* Buffer — inline editable */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {t("employees.services.bufferMinutes")}:
        </span>
        <BufferCell
          value={ps.bufferMinutes ?? 0}
          isSaving={isSaving}
          ariaLabel={t("employees.services.inlineBufferAria")}
          unitLabel={minUnit}
          emptyHintLabel={t("employees.services.inlineBufferEmpty")}
          onCommit={handlePatchBuffer}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={onEdit}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
          {t("common.edit")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
          {t("common.delete")}
        </Button>
      </div>
    </SurfaceRow>
  )
}

/* ─── Helpers ─── */

interface TypeBadgeInfo {
  type: string
  label: string
}

function buildTypeBadges(
  ps: EmployeeService,
  t: (key: string) => string,
  sarUnit: string,
  minUnit: string,
): TypeBadgeInfo[] {
  /* If serviceTypes exist (new per-type model), use them */
  if (ps.serviceTypes && ps.serviceTypes.length > 0) {
    return ps.serviceTypes
      .filter((st) => st.isActive)
      .map((st) => {
        const deliveryType = st.deliveryType
        const key = TYPE_LABEL_MAP[deliveryType]
        const typeLabel = key ? t(`employees.services.${key}`) : deliveryType
        const price = st.price != null
          ? formatPrice(Number(st.price))
          : t("employees.services.defaultPrice")
        const duration = st.duration != null
          ? String(st.duration)
          : t("employees.services.defaultPrice")
        return {
          type: deliveryType,
          label: `${typeLabel}: ${price} ${sarUnit} | ${duration}${minUnit}`,
        }
      })
  }

  /* Fallback: legacy availableTypes + single price display */
  if (!ps.availableTypes) return []
  return ps.availableTypes.map((type) => {
    const key = TYPE_LABEL_MAP[type]
    const typeLabel = key ? t(`employees.services.${key}`) : type
    const duration = ps.customDuration ?? ps.service.duration
    const priceVal =
      type === "clinic_visit" && ps.priceClinic != null
        ? formatPrice(Number(ps.priceClinic))
        : type === "phone_consultation" && ps.pricePhone != null
          ? formatPrice(Number(ps.pricePhone))
          : type === "video_consultation" && ps.priceVideo != null
            ? formatPrice(Number(ps.priceVideo))
            : t("employees.services.defaultPrice")

    return {
      type,
      label: `${typeLabel}: ${priceVal} ${sarUnit} | ${duration}${minUnit}`,
    }
  })
}
