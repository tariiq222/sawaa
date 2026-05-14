"use client"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { AvailabilitySlot } from "@/lib/types/employee"
import type { LocalBreak } from "./schedule-types"

interface DayScheduleCardProps {
  slot: AvailabilitySlot
  extraSlots?: Array<{ slot: AvailabilitySlot; idx: number }>
  dayName: string
  dayBreaks: LocalBreak[]
  addBreakLabel: string
  addSecondWindowLabel?: string
  onSlotChange: (field: keyof AvailabilitySlot, value: string | boolean) => void
  onExtraSlotChange?: (idx: number, field: keyof AvailabilitySlot, value: string | boolean) => void
  onAddSecondWindow?: () => void
  onRemoveExtraSlot?: (idx: number) => void
  onAddBreak: () => void
  onRemoveBreak: (key: string) => void
  onUpdateBreak: (key: string, field: "startTime" | "endTime", value: string) => void
}

export function DayScheduleCard({
  slot,
  extraSlots = [],
  dayName,
  dayBreaks,
  addBreakLabel,
  addSecondWindowLabel,
  onSlotChange,
  onExtraSlotChange,
  onAddSecondWindow,
  onRemoveExtraSlot,
  onAddBreak,
  onRemoveBreak,
  onUpdateBreak,
}: DayScheduleCardProps) {
  const { t } = useLocale()
  return (
    <div className="rounded-md border border-border p-3 space-y-2.5">
      {/* Day header: toggle + name */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{dayName}</Label>
        <Switch
          checked={slot.isActive}
          onCheckedChange={(v) => onSlotChange("isActive", v)}
        />
      </div>

      {/* Primary window */}
      <div className="flex items-center gap-1.5">
        <Input
          type="time"
          disabled={!slot.isActive}
          className="h-9 text-xs tabular-nums"
          value={slot.startTime}
          onChange={(e) => onSlotChange("startTime", e.target.value)}
        />
        <span className="text-[10px] text-muted-foreground shrink-0">
          {t("schedule.to")}
        </span>
        <Input
          type="time"
          disabled={!slot.isActive}
          className="h-9 text-xs tabular-nums"
          value={slot.endTime}
          onChange={(e) => onSlotChange("endTime", e.target.value)}
        />
      </div>

      {/* Extra windows (split shifts) */}
      {slot.isActive && extraSlots.map(({ slot: ex, idx }) => (
        <div key={idx} className="flex items-center gap-1.5">
          <Input
            type="time"
            className="h-9 text-xs tabular-nums"
            value={ex.startTime}
            onChange={(e) => onExtraSlotChange?.(idx, "startTime", e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {t("schedule.to")}
          </span>
          <Input
            type="time"
            className="h-9 text-xs tabular-nums"
            value={ex.endTime}
            onChange={(e) => onExtraSlotChange?.(idx, "endTime", e.target.value)}
          />
          <button
            type="button"
            onClick={() => onRemoveExtraSlot?.(idx)}
            aria-label={t("schedule.removeBreak")}
            className="text-xs text-destructive/80 hover:text-destructive"
          >
            ×
          </button>
        </div>
      ))}

      {slot.isActive && onAddSecondWindow && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full text-xs text-muted-foreground"
          onClick={onAddSecondWindow}
        >
          {addSecondWindowLabel ?? "+ Second window"}
        </Button>
      )}

      {/* Breaks */}
      {slot.isActive && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {dayBreaks.map((b) => (
            <div key={b.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {t("schedule.break")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onRemoveBreak(b.key)}
                >
                  {t("schedule.removeBreak")}
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="time"
                  className="h-8 text-xs tabular-nums"
                  value={b.startTime}
                  onChange={(e) => onUpdateBreak(b.key, "startTime", e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {t("schedule.to")}
                </span>
                <Input
                  type="time"
                  className="h-8 text-xs tabular-nums"
                  value={b.endTime}
                  onChange={(e) => onUpdateBreak(b.key, "endTime", e.target.value)}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full text-xs text-muted-foreground"
            onClick={onAddBreak}
          >
            + {addBreakLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
