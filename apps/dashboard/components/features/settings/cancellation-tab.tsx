"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, Button, Input, Skeleton, Switch } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { cn } from "@/lib/utils"
import { useBookingSettings, useBookingSettingsMutation } from "@/hooks/use-organization-settings"
import type { RefundType } from "@/lib/api/booking-settings"

type TabId = "refunds" | "rescheduling" | "automation"

interface Props {
  t: (key: string) => string
}

function NumberRow({
  label,
  desc,
  value,
  onChange,
  unit,
  min = 0,
  max,
}: {
  label: string
  desc: string
  value: string
  onChange: (v: string) => void
  unit: string
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 tabular-nums"
          min={min}
          max={max}
        />
        <span className="w-8 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

function SwitchRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
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
    setAutoComplete(String(settings.autoCompleteAfterHours ?? 2))
    setAutoNoShow(String(settings.autoNoShowAfterMinutes ?? 30))
  }, [settings])

  const save = (data: Record<string, unknown>) => {
    mutation.mutate(data, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
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
        <div className="flex w-64 shrink-0 flex-col border-e border-border bg-surface-muted">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("settings.cancellationPolicy")}
            </p>
          </div>
          <div role="tablist" className="flex-1 space-y-1.5 p-3">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={0}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveTab(tab.id) }}
                className={cn(
                  "w-full cursor-pointer select-none rounded-lg px-3 py-2.5 transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                )}
              >
                <p className="truncate text-sm font-medium leading-tight">{tab.label}</p>
                {activeTab === tab.id && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-tight opacity-80">{tab.desc}</p>
                )}
              </div>
            ))}
          </div>
        </div>

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
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.lateRefundPercent")} desc={t("settings.lateRefundPercentDesc")} value={latePercent} onChange={setLatePercent} unit="%" max={100} />
                </CardContent></Card>
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
                  <NumberRow label={t("settings.autoCompleteAfter")} desc={t("settings.autoCompleteAfterDesc")} value={autoComplete} onChange={setAutoComplete} unit="h" />
                </CardContent></Card>
                <Card className="bg-surface shadow-sm"><CardContent className="pt-2 pb-2">
                  <NumberRow label={t("settings.autoNoShowAfter")} desc={t("settings.autoNoShowAfterDesc")} value={autoNoShow} onChange={setAutoNoShow} unit="min" />
                </CardContent></Card>
              </div>
              <div className="mt-auto flex justify-end pt-2">
                <Button size="sm" disabled={mutation.isPending} onClick={() => save({
                  autoCompleteAfterHours: Number(autoComplete) || 2,
                  autoNoShowAfterMinutes: Number(autoNoShow) || 30,
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
