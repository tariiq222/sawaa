"use client"

import { useState } from "react"

import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import {
  useEmployeeAvailability,
  useEmployeeBreaks,
} from "@/hooks/use-employees"
import { ScheduleEditor } from "./schedule-editor"

/* ─── Constants ─── */

const DAY_NAMES = [
  "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
] as const

/* ─── Props ─── */

interface ScheduleSectionProps {
  employeeId: string
}

/* ─── Component ─── */

export function ScheduleSection({ employeeId }: ScheduleSectionProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const { data: slots, isLoading: loadingSlots } =
    useEmployeeAvailability(employeeId)
  const { data: breaks, isLoading: loadingBreaks } =
    useEmployeeBreaks(employeeId)

  const isLoading = loadingSlots || loadingBreaks

  /* Group breaks by day for display */
  const breaksByDay = (breaks ?? []).reduce<Record<number, typeof breaks>>(
    (acc, b) => {
      if (!b) return acc
      const arr = acc[b.dayOfWeek] ?? []
      arr.push(b)
      acc[b.dayOfWeek] = arr
      return acc
    },
    {},
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Schedule & Breaks
        </h4>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setEditorOpen(true)}
        >
          Edit Schedule
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !slots || slots.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No schedule configured.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {slots.map((slot) => {
            const dayBreaks = breaksByDay[slot.dayOfWeek] ?? []
            return (
              <div key={slot.dayOfWeek} className="flex flex-col">
                {/* Day row */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {DAY_NAMES[slot.dayOfWeek]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium text-foreground">
                      {slot.startTime} — {slot.endTime}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        slot.isActive
                          ? "border-success/30 bg-success/10 text-success text-[10px]"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground text-[10px]"
                      }
                    >
                      {slot.isActive ? "On" : "Off"}
                    </Badge>
                  </div>
                </div>

                {/* Breaks for this day */}
                {dayBreaks.length > 0 && (
                  <div className="flex flex-col gap-0.5 ps-4">
                    {dayBreaks.map((b, bi) => (
                      <span
                        key={b.id ?? `${b.dayOfWeek}-brk-${bi}`}
                        className="text-xs text-muted-foreground tabular-nums"
                      >
                        Break: {b.startTime} — {b.endTime}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ScheduleEditor
        employeeId={employeeId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
