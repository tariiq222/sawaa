"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useEmployeeBreaks, useSetBreaks } from "@/hooks/use-employees"

/* ─── Constants ─── */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

interface LocalBreak {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

let keyCounter = 0
function nextKey() {
  keyCounter += 1
  return `break-${keyCounter}`
}

/* ─── Props ─── */

interface BreaksEditorProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function BreaksEditor({
  employeeId,
  open,
  onOpenChange,
}: BreaksEditorProps) {
  const { t } = useLocale()
  const { data: serverBreaks } = useEmployeeBreaks(employeeId)
  const setBreaks = useSetBreaks()
  const [breaks, setLocalBreaks] = useState<LocalBreak[]>([])

  /* Populate from server data */
  useEffect(() => {
    if (!serverBreaks) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalBreaks(
      serverBreaks.map((b) => ({
        key: nextKey(),
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
      }))
    )
  }, [serverBreaks])

  const addBreak = (dayOfWeek: number) => {
    setLocalBreaks((prev) => [
      ...prev,
      { key: nextKey(), dayOfWeek, startTime: "12:00", endTime: "13:00" },
    ])
  }

  const removeBreak = (key: string) => {
    setLocalBreaks((prev) => prev.filter((b) => b.key !== key))
  }

  const updateBreak = (
    key: string,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setLocalBreaks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, [field]: value } : b))
    )
  }

  const handleSave = async () => {
    // Validate all breaks
    for (const b of breaks) {
      if (b.startTime >= b.endTime) {
        toast.error(
          `Invalid break on ${DAY_NAMES[b.dayOfWeek]}: start must be before end`
        )
        return
      }
    }

    try {
      await setBreaks.mutateAsync({
        id: employeeId,
        breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
          dayOfWeek,
          startTime,
          endTime,
        })),
      })
      toast.success("Breaks updated successfully")
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update breaks"
      )
    }
  }

  /* Group breaks by day */
  const breaksByDay = DAY_NAMES.map((_, dayIndex) =>
    breaks.filter((b) => b.dayOfWeek === dayIndex)
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>{t("breaks.editTitle")}</SheetTitle>
          <SheetDescription>{t("breaks.editDesc")}</SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="flex flex-col gap-4">
            {DAY_NAMES.map((dayName, dayIndex) => (
              <div
                key={dayIndex}
                className="flex flex-col gap-2 rounded-md border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">{dayName}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => addBreak(dayIndex)}
                  >
                    Add Break
                  </Button>
                </div>

                {breaksByDay[dayIndex].length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("breaks.noBreaks")}
                  </p>
                ) : (
                  breaksByDay[dayIndex].map((b) => (
                    <div key={b.key} className="flex items-center gap-2">
                      <Input
                        type="time"
                        className="h-7 text-xs tabular-nums"
                        value={b.startTime}
                        onChange={(e) =>
                          updateBreak(b.key, "startTime", e.target.value)
                        }
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        className="h-7 text-xs tabular-nums"
                        value={b.endTime}
                        onChange={(e) =>
                          updateBreak(b.key, "endTime", e.target.value)
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => removeBreak(b.key)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={setBreaks.isPending}
          >
            {setBreaks.isPending ? "Saving..." : "Save Breaks"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
