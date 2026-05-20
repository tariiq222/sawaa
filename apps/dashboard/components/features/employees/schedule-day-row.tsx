"use client"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import type { LocalBreak } from "./schedule-editor.types"

/* ─── Props ─── */

interface ScheduleDayRowProps {
  index: number
  fieldId: string
  isActive: boolean
  dayBreaks: LocalBreak[]
  onToggle: (active: boolean) => void
  onTimeChange?: (field: "startTime" | "endTime", value: string) => void
  startTimeProps: React.InputHTMLAttributes<HTMLInputElement>
  endTimeProps: React.InputHTMLAttributes<HTMLInputElement>
  onAddBreak: () => void
  onRemoveBreak: (key: string) => void
  onUpdateBreak: (key: string, field: "startTime" | "endTime", value: string) => void
  t: (key: string) => string
}

/* ─── Component ─── */

export function ScheduleDayRow({
  index,
  fieldId,
  isActive,
  dayBreaks,
  onToggle,
  startTimeProps,
  endTimeProps,
  onAddBreak,
  onRemoveBreak,
  onUpdateBreak,
  t,
}: ScheduleDayRowProps) {
  return (
    <div key={fieldId} className="rounded-md border border-border p-3">
      {/* Day row */}
      <div className="flex items-center gap-3">
        <div className="flex w-24 shrink-0 items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={onToggle}
          />
          <Label className="text-xs font-medium">
            {t(`employees.day.${index}`)}
          </Label>
        </div>
        <Input
          type="time"
          disabled={!isActive}
          className="h-8 text-xs tabular-nums"
          {...startTimeProps}
        />
        <span className="text-xs text-muted-foreground">{t("schedule.to")}</span>
        <Input
          type="time"
          disabled={!isActive}
          className="h-8 text-xs tabular-nums"
          {...endTimeProps}
        />
      </div>

      {/* Breaks */}
      {isActive && (
        <div className="mt-2 flex flex-col gap-1.5 ps-8">
          {dayBreaks.map((b) => (
            <div key={b.key} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground shrink-0">
                {t("schedule.break")}
              </span>
              <Input
                type="time"
                className="h-7 text-xs tabular-nums"
                value={b.startTime}
                onChange={(e) => onUpdateBreak(b.key, "startTime", e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">
                {t("schedule.to")}
              </span>
              <Input
                type="time"
                className="h-7 text-xs tabular-nums"
                value={b.endTime}
                onChange={(e) => onUpdateBreak(b.key, "endTime", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-destructive hover:text-destructive"
                onClick={() => onRemoveBreak(b.key)}
              >
                {t("schedule.removeBreak")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-fit text-[10px] text-muted-foreground"
            onClick={onAddBreak}
          >
            {t("employees.create.addBreak")}
          </Button>
        </div>
      )}
    </div>
  )
}
