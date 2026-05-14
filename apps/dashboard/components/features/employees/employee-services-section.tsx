"use client"

import { useState } from "react"
import { halalasToSar } from "@/lib/money"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@deqah/ui"
import { Button } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useEmployeeServices } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { AssignServiceSheet } from "./assign-service-sheet"
import { EditEmployeeServiceSheet } from "./edit-employee-service-sheet"
import { RemoveServiceDialog } from "./remove-service-dialog"
import type { EmployeeService } from "@/lib/types/employee"

/* ─── Constants ─── */

const TYPE_LABEL_MAP: Record<string, string> = {
  clinic_visit: "clinicVisit",
  phone_consultation: "phoneConsultation",
  video_consultation: "videoConsultation",
}

/* ─── Props ─── */

interface Props {
  employeeId: string
}

/* ─── Component ─── */

export function EmployeeServicesSection({ employeeId }: Props) {
  const { locale, t } = useLocale()
  const { data: services, isLoading } =
    useEmployeeServices(employeeId)

  const [assignOpen, setAssignOpen] = useState(false)
  const [editTarget, setEditTarget] =
    useState<EmployeeService | null>(null)
  const [removeTarget, setRemoveTarget] =
    useState<EmployeeService | null>(null)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("employees.services.title")}
          {services && services.length > 0 && ` (${services.length})`}
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setAssignOpen(true)}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          {t("employees.services.assign")}
        </Button>
      </div>

      {/* Empty State */}
      {(!services || services.length === 0) && (
        <p className="text-sm text-muted-foreground">
          {t("employees.services.noServices")}
        </p>
      )}

      {/* Service List */}
      {services?.map((ps) => (
        <ServiceRow
          key={ps.id}
          ps={ps}
          locale={locale}
          t={t}
          onEdit={() => setEditTarget(ps)}
          onRemove={() => setRemoveTarget(ps)}
        />
      ))}

      {/* Sheets & Dialogs */}
      <AssignServiceSheet
        employeeId={employeeId}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
      <EditEmployeeServiceSheet
        employeeId={employeeId}
        employeeService={editTarget}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      />
      <RemoveServiceDialog
        employeeId={employeeId}
        employeeService={removeTarget}
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      />
    </div>
  )
}

/* ─── Service Row ─── */

interface ServiceRowProps {
  ps: EmployeeService
  locale: string
  t: (key: string) => string
  onEdit: () => void
  onRemove: () => void
}

function ServiceRow({ ps, locale, t, onEdit, onRemove }: ServiceRowProps) {
  const name = ps.service
    ? locale === "ar"
      ? ps.service.nameAr
      : ps.service.nameEn
    : t("employees.services.unknown")
  const sarUnit = t("employees.services.sar")
  const minUnit = t("employees.services.minutes")

  /* Per-type badges */
  const typeBadges = buildTypeBadges(ps, t, sarUnit, minUnit)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      {/* Top row: name + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${
              ps.isActive ? "bg-success" : "bg-muted-foreground"
            }`}
          />
          <span className="text-sm font-medium text-foreground">
            {name}
          </span>
        </div>
        <Badge
          variant="outline"
          className={
            ps.isActive
              ? "border-success/30 bg-success/10 text-success"
              : "border-muted-foreground/30 bg-muted text-muted-foreground"
          }
        >
          {ps.isActive ? t("common.active") : t("common.inactive")}
        </Badge>
      </div>

      {/* Type info pills */}
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

      {/* Buffer info (only if non-zero) */}
      {ps.bufferMinutes > 0 && (
        <div className="text-xs text-muted-foreground tabular-nums">
          {t("employees.services.bufferMinutes")}: {ps.bufferMinutes} {minUnit}
        </div>
      )}

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
    </div>
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
        const key = TYPE_LABEL_MAP[st.bookingType]
        const typeLabel = key ? t(`employees.services.${key}`) : st.bookingType
        const price = st.price != null
          ? halalasToSar(st.price).toFixed(0)
          : t("employees.services.defaultPrice")
        const duration = st.duration != null
          ? String(st.duration)
          : t("employees.services.defaultPrice")
        return {
          type: st.bookingType,
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
        ? halalasToSar(ps.priceClinic).toFixed(0)
        : type === "phone_consultation" && ps.pricePhone != null
          ? halalasToSar(ps.pricePhone).toFixed(0)
          : type === "video_consultation" && ps.priceVideo != null
            ? halalasToSar(ps.priceVideo).toFixed(0)
            : t("employees.services.defaultPrice")

    return {
      type,
      label: `${typeLabel}: ${priceVal} ${sarUnit} | ${duration}${minUnit}`,
    }
  })
}
