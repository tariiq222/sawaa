"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import type { AvailabilitySlot } from "@/lib/types/employee"
import { DAY_NAME_KEYS } from "./schedule-types"
import type { LocalBreak, LocalVacation } from "./schedule-types"
import { nextBreakKey } from "./schedule-types"
import { VacationCard } from "./vacation-card"
import { DayScheduleCard } from "./day-schedule-card"

export type { LocalBreak, LocalVacation }

/* ─── Props ─── */

interface ScheduleTabProps {
  schedule: AvailabilitySlot[]
  onScheduleChange: (schedule: AvailabilitySlot[]) => void
  breaks: LocalBreak[]
  onBreaksChange: (breaks: LocalBreak[]) => void
  vacation: LocalVacation
  onVacationChange: (vacation: LocalVacation) => void
}

/* ─── Component ─── */

export function ScheduleTab({
  schedule,
  onScheduleChange,
  breaks,
  onBreaksChange,
  vacation,
  onVacationChange,
}: ScheduleTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const { weekStartDay } = useOrganizationConfig()

  // JS day index: 0=Sun, 1=Mon, ..., 6=Sat. Saudi clinics default to Sat-first
  // on AR locale; EN locale or explicit `monday` setting use Mon-Sun. Any other
  // value keeps Sun-Sat.
  const dayOrder = (() => {
    if (weekStartDay === "monday") return [1, 2, 3, 4, 5, 6, 0]
    if (isAr) return [6, 0, 1, 2, 3, 4, 5] // Sat-first for Arabic clinics
    return [0, 1, 2, 3, 4, 5, 6]
  })()

  const dayNames = DAY_NAME_KEYS.map((key) => t(key))

  /* Split-shift helpers: a day can have multiple slots. */
  const slotsByDay = (day: number) =>
    schedule
      .map((s, idx) => ({ slot: s, idx }))
      .filter(({ slot }) => slot.dayOfWeek === day)

  const updateSlotAt = (
    idx: number,
    field: keyof AvailabilitySlot,
    value: string | boolean,
  ) => {
    const updated = [...schedule]
    updated[idx] = { ...updated[idx], [field]: value }
    onScheduleChange(updated)
  }

  const addSecondWindow = (day: number) => {
    onScheduleChange([
      ...schedule,
      { dayOfWeek: day, startTime: "16:00", endTime: "20:00", isActive: true },
    ])
  }

  const removeSlotAt = (idx: number) => {
    onScheduleChange(schedule.filter((_, i) => i !== idx))
  }

  /* Break handlers */
  const addBreak = (dayOfWeek: number) => {
    onBreaksChange([
      ...breaks,
      { key: nextBreakKey(), dayOfWeek, startTime: "12:00", endTime: "13:00" },
    ])
  }

  const removeBreak = (key: string) => {
    onBreaksChange(breaks.filter((b) => b.key !== key))
  }

  const updateBreak = (
    key: string,
    field: "startTime" | "endTime",
    value: string,
  ) => {
    onBreaksChange(
      breaks.map((b) => (b.key === key ? { ...b, [field]: value } : b)),
    )
  }

  const breaksByDay = (day: number) => breaks.filter((b) => b.dayOfWeek === day)

  return (
    <div className="space-y-4">
      <VacationCard
        vacation={vacation}
        onVacationChange={onVacationChange}
      />

      <Card
        className={vacation.enabled ? "opacity-40 pointer-events-none" : ""}
        aria-disabled={vacation.enabled || undefined}
        {...(vacation.enabled ? { inert: true } : {})}
      >
        <CardHeader>
          <CardTitle>{t("employees.create.scheduleSection")}</CardTitle>
          <CardDescription>
            {vacation.enabled
              ? t("schedule.suspended")
              : t("schedule.setHours")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {dayOrder.map((day) => {
              const entries = slotsByDay(day)
              const primary = entries[0]
              if (!primary) return null
              return (
                <DayScheduleCard
                  key={day}
                  slot={primary.slot}
                  extraSlots={entries.slice(1).map((e) => ({ slot: e.slot, idx: e.idx }))}
                  dayName={dayNames[day]}
                  dayBreaks={breaksByDay(day)}
                  addBreakLabel={t("employees.create.addBreak")}
                  addSecondWindowLabel={t("employees.create.secondWindow")}
                  onSlotChange={(field, value) => updateSlotAt(primary.idx, field, value)}
                  onExtraSlotChange={(idx, field, value) => updateSlotAt(idx, field, value)}
                  onAddSecondWindow={() => addSecondWindow(day)}
                  onRemoveExtraSlot={(idx) => removeSlotAt(idx)}
                  onAddBreak={() => addBreak(day)}
                  onRemoveBreak={removeBreak}
                  onUpdateBreak={updateBreak}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
