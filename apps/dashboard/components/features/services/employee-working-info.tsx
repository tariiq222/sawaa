"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon, ArrowUp01Icon, Add01Icon, Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"

import { useBranches } from "@/hooks/use-branches"
import { useEmployeeSchedule, useUpdateEmployeeSchedule } from "@/hooks/use-employee-schedule"
import { useEmployee } from "@/hooks/use-employees"
import { assignEmployeeToBranch, unassignEmployeeFromBranch } from "@/lib/api/branches"
import { queryKeys } from "@/lib/query-keys"
import type { AvailabilitySlot } from "@/lib/types/employee"
import { useLocale } from "@/components/locale-provider"

interface EmployeeWorkingInfoProps {
  employeeId: string
  branchIds?: string[]
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

export function EmployeeWorkingInfo({ employeeId, branchIds: propBranchIds }: EmployeeWorkingInfoProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const queryClient = useQueryClient()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAddingBranch, setIsAddingBranch] = useState(false)
  const [branchSearch, setBranchSearch] = useState("")

  const { branches } = useBranches()
  const { data: schedule = [], isLoading: scheduleLoading } = useEmployeeSchedule(employeeId)
  const updateScheduleMut = useUpdateEmployeeSchedule(employeeId)

  const branchIdsMissing = !propBranchIds || propBranchIds.length === 0
  const { data: employee } = useEmployee(branchIdsMissing ? employeeId : null)
  const branchIds = propBranchIds ?? employee?.branchIds ?? []

  const branchName = (id: string) => {
    const b = branches.find((x) => x.id === id)
    if (!b) return id
    return isAr ? b.nameAr : (b.nameEn ?? b.nameAr)
  }

  const visibleBranches = branchIds.slice(0, 3)
  const hiddenBranchesCount = Math.max(0, branchIds.length - 3)
  const scheduleSummary = useMemo(() => summariseSchedule(schedule, t), [schedule, t])

  const handleToggleDay = (dayOfWeek: number, next: boolean) => {
    const updated: AvailabilitySlot[] = DAY_KEYS.map((_, idx) => {
      const existing = schedule.find((s) => s.dayOfWeek === idx)
      return existing
        ? { ...existing, isActive: idx === dayOfWeek ? next : existing.isActive }
        : {
            dayOfWeek: idx,
            startTime: "09:00",
            endTime: "17:00",
            isActive: idx === dayOfWeek ? next : false,
          }
    })
    updateScheduleMut.mutate(updated, {
      onSuccess: () => toast.success(t("services.employees.workingInfo.savedToast")),
      onError: () => toast.error(t("services.employees.workingInfo.saveErrorToast")),
    })
  }

  const handleTimeChange = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    const updated = DAY_KEYS.map((_, idx) => {
      const existing = schedule.find((s) => s.dayOfWeek === idx)
      return existing
        ? { ...existing, [field]: idx === dayOfWeek ? value : existing[field] }
        : {
            dayOfWeek: idx,
            startTime: "09:00",
            endTime: "17:00",
            isActive: false,
            [field]: idx === dayOfWeek ? value : (field === "startTime" ? "09:00" : "17:00"),
          }
    })
    updateScheduleMut.mutate(updated)
  }

  const handleRemoveBranch = async (branchId: string) => {
    try {
      await unassignEmployeeFromBranch(branchId, employeeId)
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) })
      toast.success(t("services.employees.workingInfo.branchRemovedToast"))
    } catch {
      toast.error(t("services.employees.workingInfo.branchErrorToast"))
    }
  }

  const handleAddBranch = async (branchId: string) => {
    try {
      await assignEmployeeToBranch(branchId, employeeId)
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.employees.detail(employeeId) })
      toast.success(t("services.employees.workingInfo.branchAddedToast"))
      setIsAddingBranch(false)
      setBranchSearch("")
    } catch {
      toast.error(t("services.employees.workingInfo.branchErrorToast"))
    }
  }

  const availableToAdd = branches.filter(
    (b) =>
      !branchIds.includes(b.id) &&
      (isAr ? b.nameAr : b.nameEn ?? b.nameAr).toLowerCase().includes(branchSearch.toLowerCase()),
  )

  return (
    <SurfaceRow variant="default" size="sm" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center justify-between gap-2 text-start"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("services.employees.workingInfo.title")}
        </span>
        <HugeiconsIcon
          icon={isExpanded ? ArrowUp01Icon : ArrowDown01Icon}
          strokeWidth={2}
          className="size-3.5 text-muted-foreground"
        />
      </button>

      {!isExpanded && (
        <div className="flex flex-col gap-1.5 px-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("services.employees.workingInfo.branches")}:</span>
            {branchIds.length === 0 ? (
              <span className="text-muted-foreground/70">{t("services.employees.workingInfo.noBranches")}</span>
            ) : (
              <>
                {visibleBranches.map((id) => (
                  <span key={id} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {branchName(id)}
                  </span>
                ))}
                {hiddenBranchesCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">+{hiddenBranchesCount}</span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{t("services.employees.workingInfo.schedule")}:</span>
            {scheduleLoading ? (
              <Skeleton className="h-3 w-24" />
            ) : (
              <span className="tabular-nums text-foreground">{scheduleSummary}</span>
            )}
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("services.employees.workingInfo.branches")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {branchIds.length === 0 ? (
                <span className="text-[10px] text-muted-foreground/70">{t("services.employees.workingInfo.noBranches")}</span>
              ) : (
                branchIds.map((id) => (
                  <span
                    key={id}
                    data-testid="branch-row"
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {branchName(id)}
                    <button
                      type="button"
                      onClick={() => handleRemoveBranch(id)}
                      aria-label={t("services.employees.workingInfo.removeBranch")}
                      className="text-primary hover:text-error"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  </span>
                ))
              )}
              <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px]" onClick={() => setIsAddingBranch((v) => !v)}>
                <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
                {t("services.employees.workingInfo.addBranch")}
              </Button>
            </div>
            {isAddingBranch && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-md border border-border bg-surface-muted/40 p-2">
                <div className="relative">
                  <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="absolute start-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder={t("services.employees.workingInfo.addBranchSearch")}
                    className="h-7 ps-7 text-xs"
                  />
                </div>
                {availableToAdd.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground/70">{t("services.employees.workingInfo.addBranchNone")}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {availableToAdd.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => handleAddBranch(b.id)}
                          className="w-full rounded px-2 py-1 text-start text-xs hover:bg-surface-muted"
                        >
                          {isAr ? b.nameAr : b.nameEn ?? b.nameAr}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("services.employees.workingInfo.schedule")}
            </span>
            <div className="flex flex-col gap-1">
              {DAY_KEYS.map((dayKey, idx) => {
                const slot = schedule.find((s) => s.dayOfWeek === idx)
                return (
                  <div key={dayKey} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md bg-surface-muted/40 px-2 py-1">
                    <Switch
                      checked={slot?.isActive ?? false}
                      onCheckedChange={(next) => handleToggleDay(idx, next)}
                      aria-label={t("services.employees.workingInfo.dayActive")}
                      className="scale-90"
                    />
                    <span className="text-[11px] text-foreground">{t(`services.employees.workingInfo.day.${dayKey}`)}</span>
                    <Input
                      type="time"
                      value={slot?.startTime ?? "09:00"}
                      onChange={(e) => handleTimeChange(idx, "startTime", e.target.value)}
                      className="h-7 w-20 text-[11px] tabular-nums"
                    />
                    <Input
                      type="time"
                      value={slot?.endTime ?? "17:00"}
                      onChange={(e) => handleTimeChange(idx, "endTime", e.target.value)}
                      className="h-7 w-20 text-[11px] tabular-nums"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </SurfaceRow>
  )
}

function summariseSchedule(schedule: AvailabilitySlot[], t: (k: string) => string): string {
  if (schedule.length === 0) return t("services.employees.workingInfo.scheduleNone")
  const active = schedule.filter((s) => s.isActive)
  if (active.length === 0) return t("services.employees.workingInfo.scheduleNone")
  const first = active[0]
  const allSame = active.every((s) => s.startTime === first.startTime && s.endTime === first.endTime)
  if (!allSame) return t("services.employees.workingInfo.scheduleVaried")
  const days = active.map((s) => s.dayOfWeek).sort((a, b) => a - b)
  const isContiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  if (!isContiguous) return t("services.employees.workingInfo.scheduleVaried")
  const firstDay = days[0]
  const DAY_LABEL_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
  return `${days.length} ${t(`services.employees.workingInfo.day.${DAY_LABEL_KEYS[firstDay]}`)}–${first.startTime}–${first.endTime}`
}