"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Skeleton } from "@sawaa/ui"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-organization-settings"
import { CancellationPolicyForm } from "./cancellation-policy-form"
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

export function CancellationTab({ t }: Props) {
  const { data: settings, isLoading } = useBookingSettings()
  const mutation = useBookingSettingsMutation()

  const [activeTab, setActiveTab] = useState<TabId>("refunds")
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
            <CancellationPolicyForm settings={settings} t={t} save={save} pending={mutation.isPending} />
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
