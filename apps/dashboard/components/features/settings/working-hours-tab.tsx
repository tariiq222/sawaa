"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon } from "@hugeicons/core-free-icons"
import { Card, CardContent } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { cn } from "@/lib/utils"
import type { OrganizationHour } from "@/lib/api/organization"
import { useOrganizationHours, useOrganizationHoursMutation } from "@/hooks/use-organization-settings"
import { HolidaysSection } from "./holidays-section"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { SettingsTabSidebar } from "./settings-tab-sidebar"

/* ─── Constants ─── */

const DAYS_BASE = [
  { value: 0, en: "Sunday",    tKey: "settings.day.sunday" },
  { value: 1, en: "Monday",    tKey: "settings.day.monday" },
  { value: 2, en: "Tuesday",   tKey: "settings.day.tuesday" },
  { value: 3, en: "Wednesday", tKey: "settings.day.wednesday" },
  { value: 4, en: "Thursday",  tKey: "settings.day.thursday" },
  { value: 5, en: "Friday",    tKey: "settings.day.friday" },
  { value: 6, en: "Saturday",  tKey: "settings.day.saturday" },
]

function getOrderedDays(weekStart: 0 | 1) {
  if (weekStart === 1) return [...DAYS_BASE.slice(1), DAYS_BASE[0]]
  return DAYS_BASE
}

function isValidTime(value: string): boolean {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(value)
}

function buildDefaultHours(days: typeof DAYS_BASE): OrganizationHour[] {
  return days.map((d) => ({
    dayOfWeek: d.value,
    startTime: "09:00",
    endTime: "17:00",
    isActive: d.value >= 0 && d.value <= 4,
  }))
}

/* ─── Props ─── */

interface Props {
  t: (key: string) => string
}

type TabId = "hours" | "holidays"

/* ─── Working Hours Panel ─── */

function WorkingHoursPanel({ t, branchId }: Props & { branchId: string }) {
  const { weekStartDayNumber } = useOrganizationConfig()
  const orderedDays = useMemo(() => getOrderedDays(weekStartDayNumber), [weekStartDayNumber])
  const [hours, setHours] = useState<OrganizationHour[]>(() => buildDefaultHours(orderedDays))
  const hoursRef = useRef(hours)

  const { data: serverHours, isLoading } = useOrganizationHours(branchId)
  const mutation = useOrganizationHoursMutation()

  useEffect(() => {
    const defaults = buildDefaultHours(orderedDays)
    const nextHours = !serverHours || serverHours.length === 0
      ? defaults
      : defaults.map((def) => {
          const match = serverHours.find((s: OrganizationHour) => s.dayOfWeek === def.dayOfWeek)
          return match ?? { ...def, isActive: false }
        })
    hoursRef.current = nextHours
    // Sync hours grid with server data (and re-seed when weekStart day order changes).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHours(nextHours)
  }, [serverHours, orderedDays])

  const updateDay = (index: number, patch: Partial<OrganizationHour>) => {
    setHours((prev) => {
      const nextHours = prev.map((h, i) => (i === index ? { ...h, ...patch } : h))
      hoursRef.current = nextHours
      return nextHours
    })
  }

  const handleSave = () => {
    const currentHours = hoursRef.current.map((hour) => ({
      ...hour,
      startTime: formatTimeInput(hour.startTime),
      endTime: formatTimeInput(hour.endTime),
    }))

    const invalid = currentHours.filter(
      (h) => h.isActive && (!isValidTime(h.startTime) || !isValidTime(h.endTime)),
    )
    if (invalid.length > 0) {
      toast.error(t("settings.invalidTimeFormat"))
      return
    }

    hoursRef.current = currentHours
    setHours(currentHours)
    const payload = currentHours.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
      dayOfWeek, startTime, endTime, isActive,
    }))
    mutation.mutate({ branchId, hours: payload }, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-12 rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="grid grid-cols-2 gap-3">
        {hours.map((hour, index) => (
          <Card key={hour.dayOfWeek} className="shadow-sm bg-surface">
            <CardContent className="pt-2 pb-2">
              <DayRow
                day={orderedDays[index]}
                hour={hour}
                onChange={(patch) => updateDay(index, patch)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end mt-auto pt-2">
        <Button type="button" size="sm" disabled={mutation.isPending} onClick={handleSave}>
          {t("settings.save")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Day Row ─── */

function formatTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function DayRow({
  day,
  hour,
  onChange,
}: {
  day: { value: number; en: string; tKey: string }
  hour: OrganizationHour
  onChange: (patch: Partial<OrganizationHour>) => void
}) {
  const { t } = useLocale()
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-md border p-3 transition-colors",
        hour.isActive ? "border-border bg-surface" : "border-border bg-surface-muted"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Switch checked={hour.isActive} onCheckedChange={(v) => onChange({ isActive: v })} />
        <Label className="cursor-pointer select-none text-sm font-medium">
          <span className={hour.isActive ? "text-foreground" : "text-muted-foreground"}>{t(day.tKey)}</span>
        </Label>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-2][0-9]:[0-5][0-9]"
          maxLength={5}
          dir="ltr"
          disabled={!hour.isActive}
          value={hour.startTime}
          data-time-field="true"
          data-day={hour.dayOfWeek}
          data-field="startTime"
          onChange={(e) => onChange({ startTime: e.currentTarget.value })}
          onInput={(e) => onChange({ startTime: e.currentTarget.value })}
          onBlur={(e) => onChange({ startTime: formatTimeInput(e.currentTarget.value) })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-2][0-9]:[0-5][0-9]"
          maxLength={5}
          dir="ltr"
          disabled={!hour.isActive}
          value={hour.endTime}
          data-time-field="true"
          data-day={hour.dayOfWeek}
          data-field="endTime"
          onChange={(e) => onChange({ endTime: e.currentTarget.value })}
          onInput={(e) => onChange({ endTime: e.currentTarget.value })}
          onBlur={(e) => onChange({ endTime: formatTimeInput(e.currentTarget.value) })}
          className="h-8 w-28 text-center text-xs tabular-nums disabled:opacity-40"
        />
      </div>
    </div>
  )
}

/* ─── Holidays Panel ─── */

function HolidaysPanel({ t, branchId }: Props & { branchId: string }) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <HolidaysSection t={t} branchId={branchId} />
    </div>
  )
}

/* ─── Main Component ─── */

export function WorkingHoursTab({ t }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("hours")
  const { branches, isLoading: branchesLoading } = useBranches()
  const [selectedBranchId, setSelectedBranchId] = useState<string>("")

  useEffect(() => {
    if (selectedBranchId || branches.length === 0) return
    const defaultBranch = branches.find((branch) => branch.isMain && branch.isActive)
      ?? branches.find((branch) => branch.isActive)
      ?? branches[0]
    // Seed the selected branch once from server branches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedBranchId(defaultBranch.id)
  }, [branches, selectedBranchId])

  const tabs: { id: TabId; label: string; desc: string }[] = [
    {
      id: "hours",
      label: t("settings.workingHours"),
      desc: t("settings.workingHoursDesc"),
    },
    {
      id: "holidays",
      label: t("settings.holidays"),
      desc: t("settings.holidaysDesc"),
    },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        {/* ── Sidebar ── */}
        <SettingsTabSidebar
          title={t("settings.tabs.hours")}
          icon={<HugeiconsIcon icon={Clock01Icon} size={14} className="text-muted-foreground" />}
          items={tabs.map(tab => ({ id: tab.id, label: tab.label, desc: tab.desc }))}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as TabId)}
        />

        {/* ── Content ── */}
        <div className="flex-1 p-5 overflow-y-auto bg-surface-muted/50 flex flex-col gap-4">
          {branchesLoading ? (
            <Skeleton className="h-10 w-64 rounded-lg" />
          ) : branches.length === 0 ? (
            <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
              {t("settings.branches.emptyForHours")}
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder={t("settings.branches.selectForHours")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.nameAr || branch.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeTab === "hours" && selectedBranchId && <WorkingHoursPanel t={t} branchId={selectedBranchId} />}
              {activeTab === "holidays" && selectedBranchId && <HolidaysPanel t={t} branchId={selectedBranchId} />}
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
