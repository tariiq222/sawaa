"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button, Input, Label, Switch } from "@sawaa/ui"
import type { DraftAvailabilityWindow, DraftBookingType } from "./booking-types-editor"
import { nextOptionKey } from "./booking-types-editor"

const DAYS = [0, 1, 2, 3, 4, 5, 6]

interface Props {
  draft: DraftBookingType
  t: (key: string) => string
  onUpdate: (field: keyof DraftBookingType, value: unknown) => void
}

export function ServiceAvailabilityWindowsEditor({ draft, t, onUpdate }: Props) {
  const addWindow = () => {
    onUpdate("availabilityWindows", [
      ...draft.availabilityWindows,
      { key: nextOptionKey(), dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true },
    ])
  }

  const updateWindow = (key: string, field: keyof DraftAvailabilityWindow, value: unknown) => {
    onUpdate(
      "availabilityWindows",
      draft.availabilityWindows.map((window) =>
        window.key === key ? { ...window, [field]: value } : window,
      ),
    )
  }

  const removeWindow = (key: string) => {
    onUpdate(
      "availabilityWindows",
      draft.availabilityWindows.filter((window) => window.key !== key),
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium text-foreground">
            {t("services.availability.custom")}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t("services.availability.inheritHint")}
          </p>
        </div>
        <Switch
          checked={draft.useCustomAvailability}
          onCheckedChange={(checked) => onUpdate("useCustomAvailability", checked)}
          aria-label={t("services.availability.custom")}
        />
      </div>

      {draft.useCustomAvailability && (
        <div className="space-y-2">
          {draft.availabilityWindows.map((window) => (
            <div key={window.key} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("services.availability.day")}</Label>
                <select
                  value={window.dayOfWeek}
                  onChange={(event) => updateWindow(window.key, "dayOfWeek", Number(event.target.value))}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>{t(`services.availability.day.${day}`)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("services.availability.start")}</Label>
                <Input type="time" value={window.startTime} onChange={(event) => updateWindow(window.key, "startTime", event.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t("services.availability.end")}</Label>
                <Input type="time" value={window.endTime} onChange={(event) => updateWindow(window.key, "endTime", event.target.value)} className="h-8 text-xs" />
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-11 text-destructive" onClick={() => removeWindow(window.key)} aria-label={t("services.availability.remove")}>
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs" onClick={addWindow}>
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5 me-1" />
            {t("services.availability.addWindow")}
          </Button>
        </div>
      )}
    </div>
  )
}
