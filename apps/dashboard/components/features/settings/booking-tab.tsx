"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Skeleton, RadioGroup, RadioGroupItem } from "@sawaa/ui"
import { cn } from "@/lib/utils"
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
import {
  useBookingFlowOrder,
  useBookingFlowOrderMutation,
  useBookingSettings,
  useBookingSettingsMutation,
} from "@/hooks/use-organization-settings"
import { SettingsTabSidebar } from "./settings-tab-sidebar"
import { NumberRow } from "./setting-row"

type TabId = "limits" | "floworder"

interface Props {
  t: (key: string) => string
}

export function BookingTab({ t }: Props) {
  const { data: settings, isLoading: settingsLoading } = useBookingSettings()
  const settingsMut = useBookingSettingsMutation()
  const { data: flowOrder, isLoading: flowLoading } = useBookingFlowOrder()
  const flowMut = useBookingFlowOrderMutation()

  const [activeTab, setActiveTab] = useState<TabId>("limits")
  const [leadMinutes, setLeadMinutes] = useState("60")
  const [bufferMin, setBufferMin] = useState("0")
  const [maxAdvanceDays, setMaxAdvanceDays] = useState("90")
  const [flowOrderVal, setFlowOrderVal] = useState<BookingFlowOrder>("service_first")

  useEffect(() => {
    if (!settings) return
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLeadMinutes(String(settings.minBookingLeadMinutes ?? 60))
    setBufferMin(String(settings.bufferMinutes ?? 0))
    setMaxAdvanceDays(String(settings.maxAdvanceBookingDays ?? 90))
  }, [settings])

  useEffect(() => {
    // Seed editable form fields from server settings; user edits locally and saves explicitly.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flowOrder) setFlowOrderVal(flowOrder)
  }, [flowOrder])

  const handleSettingsSave = (data: Record<string, unknown>) =>
    settingsMut.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })

  if (settingsLoading || flowLoading) {
    return (
      <div className="flex gap-0 overflow-hidden rounded-xl border border-border">
        <div className="w-64 space-y-1 border-e border-border bg-surface-muted p-2">
          {[1, 2, 3].map((i) => <Skeleton key={`skeleton-${i}`} className="h-14 rounded-lg" />)}
        </div>
        <div className="flex-1 p-6"><Skeleton className="h-48 rounded-lg" /></div>
      </div>
    )
  }

  const tabs: { id: TabId; label: string; desc: string }[] = [
    { id: "limits", label: t("settings.bookingPolicies"), desc: t("settings.minBookingLeadDesc") },
    { id: "floworder", label: t("settings.booking.flowOrder.title"), desc: t("settings.booking.flowOrder.serviceFirstDesc") },
  ]

  const isSaving = settingsMut.isPending || flowMut.isPending

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex min-h-[420px]">
        <SettingsTabSidebar
          title={t("settings.bookingPolicies")}
          items={tabs.map(tab => ({ id: tab.id, label: tab.label, desc: tab.desc }))}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as TabId)}
        />

        <div role="tabpanel" className="flex flex-1 flex-col overflow-y-auto bg-surface-muted/50 p-5">
          {activeTab === "limits" && (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.minBookingLead")} desc={t("settings.minBookingLeadDesc")} value={leadMinutes} onChange={setLeadMinutes} unit="min" />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.bufferMinutes")} desc={t("settings.bufferMinutesDesc")} value={bufferMin} onChange={setBufferMin} unit="min" />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.maxAdvanceDays")} desc={t("settings.maxAdvanceDaysDesc")} value={maxAdvanceDays} onChange={setMaxAdvanceDays} unit="days" min={1} />
                </CardContent></Card>
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={isSaving} onClick={() => handleSettingsSave({
                  minBookingLeadMinutes: Number(leadMinutes) || 60,
                  bufferMinutes: Number(bufferMin) || 0,
                  maxAdvanceBookingDays: Number(maxAdvanceDays) || 90,
                })}>
                  {t("settings.save")}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "floworder" && (
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {(["service_first", "employee_first", "both"] as const).map((val) => (
                  <Card
                    key={val}
                    className={cn(
                      "cursor-pointer shadow-sm transition-all",
                      flowOrderVal === val ? "bg-primary/5 ring-2 ring-primary" : "bg-surface hover:bg-surface-muted",
                    )}
                    onClick={() => setFlowOrderVal(val)}
                  >
                    <CardContent className="pt-2 pb-2">
                      <div className="flex items-start gap-3 py-2">
                        <RadioGroup value={flowOrderVal} onValueChange={(v) => setFlowOrderVal(v as BookingFlowOrder)}>
                          <RadioGroupItem value={val} />
                        </RadioGroup>
                        <div>
                          <p className="text-sm font-medium text-foreground">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirst" : val === "employee_first" ? "employeeFirst" : "both"}`)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{t(`settings.booking.flowOrder.${val === "service_first" ? "serviceFirstDesc" : val === "employee_first" ? "employeeFirstDesc" : "bothDesc"}`)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={isSaving} onClick={() => flowMut.mutate(flowOrderVal, {
                  onSuccess: () => toast.success(t("settings.saved")),
                  onError: (err: Error) => toast.error(err.message),
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
