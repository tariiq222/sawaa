"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Video01Icon } from "@hugeicons/core-free-icons"

import { Switch } from "@sawaa/ui"
import type { DraftBookingType } from "./booking-types-editor"
import { DurationOptionsEditor } from "./duration-options-editor"

const TYPE_ICON: Record<string, typeof Building01Icon> = {
  IN_PERSON: Building01Icon,
  ONLINE: Video01Icon,
}

/* ─── Props ─── */

interface BookingTypeRowProps {
  draft: DraftBookingType
  label: string
  isAr: boolean
  t: (key: string) => string
  onToggle: () => void
  onUpdate: (field: keyof DraftBookingType, value: unknown) => void
  useClinicTerminology?: boolean
  readOnly?: boolean
}

/* ─── Component ─── */

export function BookingTypeRow({
  draft,
  label,
  t,
  onToggle,
  onUpdate,
  useClinicTerminology = false,
  readOnly = false,
}: BookingTypeRowProps) {

  const Icon = TYPE_ICON[draft.deliveryType] ?? Building01Icon

  const SectionHeader = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg " +
            (draft.enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground")
          }
        >
          <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-5" />
        </span>
        <span
          className={
            "text-sm font-medium " +
            (draft.enabled ? "text-foreground" : "text-muted-foreground")
          }
        >
          {label}
        </span>
      </div>
      <Switch
        checked={draft.enabled}
        onCheckedChange={onToggle}
        disabled={readOnly}
        aria-label={label}
      />
    </div>
  )

  if (!draft.enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
        {SectionHeader}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-solid p-4 shadow-sm space-y-4">
      {SectionHeader}

      <DurationOptionsEditor
        draft={draft}
        onUpdate={onUpdate}
        t={t}
        useClinicTerminology={useClinicTerminology}
        readOnly={readOnly}
      />
    </div>
  )
}
