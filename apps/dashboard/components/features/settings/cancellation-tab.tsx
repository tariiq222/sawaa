"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Skeleton } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-organization-settings"
import type { RefundType } from "@/lib/api/booking-settings"
import { toastApiError } from "@/lib/mutation-helpers"
import { SettingsTabSidebar } from "./settings-tab-sidebar"
import { NumberRow, SwitchRow } from "./setting-row"

type TabId = "refunds" | "rescheduling" | "automation"

interface Props {
  t: (key: string) => string
}

/**
 * Parse a non-negative integer from raw input. Used by the automation tab
 * where 0 is a valid value (0 = disabled — staff complete / mark no-show
 * manually so they keep control of the booking after the appointment).
 *
 * Rules:
 * - trim raw before checking
 * - empty / NaN / non-integer / negative → fallback
 * - "0" / " 0 " → 0 (must NOT fall back)
 * - positive integers (e.g. "2", "30") → that integer
 */
export function parseNonNegativeInt(raw: string, fallback: number): number {
  const trimmed = raw.trim()
  if (trimmed === "") return fallback
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return fallback
  if (!Number.isInteger(n)) return fallback
  if (n < 0) return fallback
  return n
}

/**
 * Resolve the value persisted to the backend for an automation delay.
 *
 * - When the switch is OFF, persist 0 (the backend treats 0 as "manual").
 * - When the switch is ON, persist the parsed positive delay. If the
 *   number field is empty or 0 we fall back to the default — the switch
 *   is the only "off" affordance, so the number field cannot sneak a 0.
 */
export function resolveAutomationDelay(
  enabled: boolean,
  raw: string,
  fallback: number,
): number {
  if (!enabled) return 0
  const n = parseNonNegativeInt(raw, fallback)
  if (n === 0) return fallback
  return n
}

function RefundSelect({
  value,
  onChange,
  t,
}: {
  value: RefundType
  onChange: (value: RefundType) => void
  t: (key: string) => string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as RefundType)}>
      <SelectTrigger className="w-40 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="FULL">{t("settings.refundFull")}</SelectItem>
        <SelectItem value="PARTIAL">{t("settings.refundPartial")}</SelectItem>
        <SelectItem value="NONE">{t("settings.refundNone")}</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function CancellationTab({ t }: Props) {
  const { data: settings, isLoading } = useBookingSettings()
  const mutation = useBookingSettingsMutation()

  const [activeTab, setActiveTab] = useState<TabId>("refunds")
  const [cancelHours, setCancelHours] = useState("24")
  const [freeRefund, setFreeRefund] = useState<RefundType>("FULL")
  const [latePercent, setLatePercent] = useState("0")
  const [requireApproval, setRequireApproval] = useState(false)
  const [autoRefund, setAutoRefund] = useState(true)
  const [rescheduleBefore, setRescheduleBefore] = useState("24")
  const [maxReschedules, setMaxReschedules] = useState("3")
  const [autoComplete, setAutoComplete] = useState("2")
  const [autoNoShow, setAutoNoShow] = useState("30")
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(true)
  const [autoNoShowEnabled, setAutoNoShowEnabled] = useState(true)
  // T2-noshow-after-end: when true (default), the no-show grace is measured
  // from the appointment end; when false, from the scheduled start (legacy).
  const [autoNoShowAfterEnd, setAutoNoShowAfterEnd] = useState(true)

  useEffect(() => {
    if (!settings) return
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCancelHours(String(settings.freeCancelBeforeHours ?? 24))
    setFreeRefund(settings.freeCancelRefundType ?? "FULL")
    setLatePercent(String(settings.lateCancelRefundPercent ?? 0))
    setRequireApproval(settings.requireCancelApproval ?? false)
    setAutoRefund(settings.autoRefundOnCancel ?? true)
    setRescheduleBefore(String(settings.clientRescheduleMinHoursBefore ?? 24))
    setMaxReschedules(String(settings.maxReschedulesPerBooking ?? 3))
    const hours = settings.autoCompleteAfterHours ?? 2
    setAutoCompleteEnabled(hours > 0)
    setAutoComplete(hours > 0 ? String(hours) : "2")
    const minutes = settings.autoNoShowAfterMinutes ?? 30
    setAutoNoShowEnabled(minutes > 0)
    setAutoNoShow(minutes > 0 ? String(minutes) : "30")
    setAutoNoShowAfterEnd(settings.autoNoShowAfterEnd ?? true)
  }, [settings])

  const save = (data: Record<string, unknown>) => {
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: toastApiError(t("settings.error"), t),
    })
  }

  if (isLoading) {
    return (
      <div className="flex gap-0 overflow-hidden rounded-xl border border-border">
        <div className="w-64 space-y-1 border-e border-border bg-surface-muted p-2">
          {[1, 2, 3].map((i) => <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "refunds", label: t("settings.cancellationPolicy"), desc: t("settings.freeRefundTypeDesc") },
    { id: "rescheduling", label: t("settings.rescheduling"), desc: t("settings.rescheduleBeforeHoursDesc") },
    { id: "automation", label: t("settings.noShow"), desc: t("settings.autoCompleteAfterDesc") },
  ]

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <SettingsTabSidebar
          title={t("settings.cancellationPolicy")}
          items={tabs.map(tab => ({ id: tab.id, label: tab.label, desc: tab.desc }))}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as TabId)}
        />

        <div className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
          {activeTab === "refunds" && (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.cancelHours")} desc={t("settings.cancelHoursDesc")} value={cancelHours} onChange={setCancelHours} unit="h" />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t("settings.freeRefundType")}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.freeRefundTypeDesc")}</p>
                    </div>
                    <RefundSelect value={freeRefund} onChange={setFreeRefund} t={t} />
                  </div>
                </CardContent></Card>
                {freeRefund === "PARTIAL" && (
                  <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                    <NumberRow label={t("settings.lateRefundPercent")} desc={t("settings.lateRefundPercentDesc")} value={latePercent} onChange={setLatePercent} unit="%" max={100} />
                  </CardContent></Card>
                )}
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.requireCancelApproval")} desc={t("settings.requireCancelApprovalDesc")} checked={requireApproval} onChange={setRequireApproval} />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <SwitchRow label={t("settings.autoRefund")} desc={t("settings.autoRefundDesc")} checked={autoRefund} onChange={setAutoRefund} />
                </CardContent></Card>
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={mutation.isPending} onClick={() => save({
                  freeCancelBeforeHours: Number(cancelHours) || 24,
                  freeCancelRefundType: freeRefund,
                  lateCancelRefundPercent: Number(latePercent) || 0,
                  requireCancelApproval: requireApproval,
                  autoRefundOnCancel: autoRefund,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "rescheduling" && (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.rescheduleBeforeHours")} desc={t("settings.rescheduleBeforeHoursDesc")} value={rescheduleBefore} onChange={setRescheduleBefore} unit="h" />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.maxReschedules")} desc={t("settings.maxReschedulesDesc")} value={maxReschedules} onChange={setMaxReschedules} unit="x" />
                </CardContent></Card>
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={mutation.isPending} onClick={() => save({
                  clientRescheduleMinHoursBefore: Number(rescheduleBefore) || 24,
                  maxReschedulesPerBooking: Number(maxReschedules) || 3,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "automation" && (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <div className="divide-y divide-border">
                    <SwitchRow
                      label={t("settings.autoCompleteEnabled")}
                      desc={t("settings.autoCompleteEnabledDesc")}
                      checked={autoCompleteEnabled}
                      onChange={setAutoCompleteEnabled}
                    />
                    {autoCompleteEnabled && (
                      <NumberRow
                        label={t("settings.autoCompleteAfter")}
                        desc={t("settings.autoCompleteAfterDesc")}
                        value={autoComplete}
                        onChange={setAutoComplete}
                        unit="h"
                      />
                    )}
                  </div>
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <div className="divide-y divide-border">
                    <SwitchRow
                      label={t("settings.autoNoShowEnabled")}
                      desc={t("settings.autoNoShowEnabledDesc")}
                      checked={autoNoShowEnabled}
                      onChange={setAutoNoShowEnabled}
                    />
                    {autoNoShowEnabled && (
                      <>
                        <NumberRow
                          label={t("settings.autoNoShowAfter")}
                          desc={t("settings.autoNoShowAfterDesc")}
                          value={autoNoShow}
                          onChange={setAutoNoShow}
                          unit="min"
                        />
                        <SwitchRow
                          label={t("settings.autoNoShowAfterEnd")}
                          desc={t("settings.autoNoShowAfterEndDesc")}
                          checked={autoNoShowAfterEnd}
                          onChange={setAutoNoShowAfterEnd}
                        />
                      </>
                    )}
                  </div>
                </CardContent></Card>
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={mutation.isPending} onClick={() => save({
                  autoCompleteAfterHours: resolveAutomationDelay(autoCompleteEnabled, autoComplete, 2),
                  autoNoShowAfterMinutes: resolveAutomationDelay(autoNoShowEnabled, autoNoShow, 30),
                  autoNoShowAfterEnd,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
