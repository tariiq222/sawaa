"use client"

import { useState } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  PencilEdit01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { ActiveCell, BufferCell } from "@/components/features/shared/inline-edit-cells"
import type { EmployeeService } from "@/lib/types/employee"

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
  const minUnit = t("employees.services.minutes")
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
