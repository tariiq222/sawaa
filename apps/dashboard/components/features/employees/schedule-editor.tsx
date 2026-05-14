"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import {
  useEmployeeAvailability,
  useEmployeeBreaks,
  useSetAvailability,
  useSetBreaks,
} from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import type { AvailabilitySlot } from "@/lib/types/employee"

import {
  DAY_NAMES,
  scheduleSchema,
  nextKey,
  type FormData,
  type LocalBreak,
} from "./schedule-editor.types"
import { ScheduleDayRow } from "./schedule-day-row"

/* ─── Constants ─── */

const DEFAULT_SCHEDULE: AvailabilitySlot[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  startTime: "09:00",
  endTime: "17:00",
  isActive: i >= 0 && i <= 4,
}))

/* ─── Props ─── */

interface ScheduleEditorProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function ScheduleEditor({
  employeeId,
  open,
  onOpenChange,
}: ScheduleEditorProps) {
  const { t } = useLocale()
  const { data: slots } = useEmployeeAvailability(employeeId)
  const { data: serverBreaks } = useEmployeeBreaks(employeeId)
  const setAvailability = useSetAvailability()
  const setBreaksMutation = useSetBreaks()

  const [breaks, setLocalBreaks] = useState<LocalBreak[]>([])

  const form = useForm<FormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { schedule: DEFAULT_SCHEDULE },
  })

  const { fields } = useFieldArray({
    control: form.control,
    name: "schedule",
  })

  /* Populate availability from server */
  useEffect(() => {
    if (!slots || slots.length === 0) return
    const merged = DEFAULT_SCHEDULE.map((def) => {
      const match = slots.find((s) => s.dayOfWeek === def.dayOfWeek)
      return match ?? { ...def, isActive: false }
    })
    form.reset({ schedule: merged })
  }, [slots, form])

  /* Populate breaks from server */
  useEffect(() => {
    if (!serverBreaks) return
    setLocalBreaks(
      serverBreaks.map((b) => ({
        key: nextKey(),
        dayOfWeek: b.dayOfWeek,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    )
  }, [serverBreaks])

  /* Break handlers */
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
    value: string,
  ) => {
    setLocalBreaks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, [field]: value } : b)),
    )
  }

  const breaksByDay = DAY_NAMES.map((_, dayIndex) =>
    breaks.filter((b) => b.dayOfWeek === dayIndex),
  )

  /* Save both schedule + breaks */
  const isSaving = setAvailability.isPending || setBreaksMutation.isPending

  const onSubmit = form.handleSubmit(async (data) => {
    for (const b of breaks) {
      if (b.startTime >= b.endTime) {
        toast.error(
          t("schedule.invalidBreak").replace("{day}", DAY_NAMES[b.dayOfWeek]),
        )
        return
      }
    }

    try {
      const activeSlots = data.schedule.filter((s) => s.isActive)
      await Promise.all([
        setAvailability.mutateAsync({
          id: employeeId,
          schedule: activeSlots,
        }),
        setBreaksMutation.mutateAsync({
          id: employeeId,
          breaks: breaks.map(({ dayOfWeek, startTime, endTime }) => ({
            dayOfWeek,
            startTime,
            endTime,
          })),
        }),
      ])
      toast.success(t("schedule.saveSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("schedule.saveError"),
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>{t("schedule.title")}</SheetTitle>
          <SheetDescription>
            {t("schedule.description")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form
            id="schedule-editor-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-3"
          >
            {fields.map((field, index) => {
              const isActive = form.watch(`schedule.${index}.isActive`)
              return (
                <ScheduleDayRow
                  key={field.id}
                  index={index}
                  fieldId={field.id}
                  isActive={isActive}
                  dayBreaks={breaksByDay[index]}
                  onToggle={(v) =>
                    form.setValue(`schedule.${index}.isActive`, v)
                  }
                  startTimeProps={form.register(`schedule.${index}.startTime`)}
                  endTimeProps={form.register(`schedule.${index}.endTime`)}
                  onAddBreak={() => addBreak(index)}
                  onRemoveBreak={removeBreak}
                  onUpdateBreak={updateBreak}
                />
              )
            })}

            {form.formState.errors.schedule && (
              <p className="text-xs text-destructive">
                {t("schedule.fixErrors")}
              </p>
            )}
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("schedule.cancel")}
          </Button>
          <Button
            type="submit"
            form="schedule-editor-form"
            disabled={isSaving}
          >
            {isSaving ? t("schedule.saving") : t("schedule.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
