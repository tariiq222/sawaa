"use client"

import { useEffect, useState } from "react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sawaa/ui"
import type { BookingSettings, ClientCancelCutoffMode, RefundType } from "@/lib/api/booking-settings"
import { SwitchRow } from "./setting-row"

type Props = {
  settings?: BookingSettings
  t: (key: string) => string
  save: (data: Record<string, unknown>) => void
  pending: boolean
}

function NumberField({ field, value, onChange, t, max }: {
  field: string; value: string; onChange: (value: string) => void
  t: Props["t"]; max?: number
}) {
  return (
    <div className="space-y-1 py-3">
      <label htmlFor={field} className="text-sm font-medium text-foreground">{t(`settings.${field}`)}</label>
      <p className="text-xs text-muted-foreground">{t(`settings.${field}Desc`)}</p>
      <Input id={field} type="number" min={0} max={max} step={1} value={value}
        onChange={(event) => onChange(event.target.value)} className="w-28 tabular-nums" />
    </div>
  )
}

export function CancellationPolicyForm({ settings, t, save, pending }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [mode, setMode] = useState<ClientCancelCutoffMode | null>(null)
  const [cutoffHours, setCutoffHours] = useState("")
  const [cancelHours, setCancelHours] = useState("24")
  const [refund, setRefund] = useState<RefundType>("FULL")
  const [earlyPercent, setEarlyPercent] = useState("")
  const [latePercent, setLatePercent] = useState("0")
  const [approval, setApproval] = useState(false)
  const [autoRefund, setAutoRefund] = useState(true)

  useEffect(() => {
    if (!settings) return
    // Seed the editable form from the current server policy, preserving zeros.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(settings.clientCancellationPolicyEnabled ?? false)
    setMode(settings.clientCancelCutoffMode ?? null)
    setCutoffHours(settings.clientCancelBeforeHours == null ? "" : String(settings.clientCancelBeforeHours))
    setCancelHours(String(settings.freeCancelBeforeHours ?? 24))
    setRefund(settings.freeCancelRefundType ?? "FULL")
    setEarlyPercent(settings.earlyCancelRefundPercent == null ? "" : String(settings.earlyCancelRefundPercent))
    setLatePercent(String(settings.lateCancelRefundPercent ?? 0))
    setApproval(settings.requireCancelApproval ?? false)
    setAutoRefund(settings.autoRefundOnCancel ?? true)
  }, [settings])

  const integer = (raw: string, max = Infinity) => raw.trim() !== "" &&
    Number.isInteger(Number(raw)) && Number(raw) >= 0 && Number(raw) <= max
  const missingCutoff = enabled && (!mode || (mode === "BEFORE_START" && !integer(cutoffHours)))
  const missingEarly = enabled && refund === "PARTIAL" && !integer(earlyPercent, 100)
  const invalid = missingCutoff || missingEarly || !integer(cancelHours) || !integer(latePercent, 100) ||
    (cutoffHours !== "" && !integer(cutoffHours)) || (earlyPercent !== "" && !integer(earlyPercent, 100))

  const submit = () => {
    if (invalid) return
    save({
      clientCancellationPolicyEnabled: enabled,
      clientCancelCutoffMode: mode,
      clientCancelBeforeHours: cutoffHours === "" ? null : Number(cutoffHours),
      earlyCancelRefundPercent: earlyPercent === "" ? null : Number(earlyPercent),
      freeCancelBeforeHours: Number(cancelHours),
      freeCancelRefundType: refund,
      lateCancelRefundPercent: Number(latePercent),
      ...(!enabled ? { requireCancelApproval: approval } : {}),
      autoRefundOnCancel: autoRefund,
    })
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-xl border border-border bg-surface p-4">
        <SwitchRow label={t("settings.clientCancellationEnabled")} desc={t("settings.clientCancellationEnabledDesc")}
          checked={enabled} onChange={setEnabled} />
        {enabled && <>
          <p className="text-sm text-foreground">{t("settings.clientCancellationImmediate")}</p>
          <div className="space-y-1 py-3">
            <label id="client-cutoff-label" className="text-sm font-medium">{t("settings.clientCancelCutoffMode")}</label>
            <Select value={mode ?? ""} onValueChange={(value) => setMode(value as ClientCancelCutoffMode)}>
              <SelectTrigger aria-labelledby="client-cutoff-label"><SelectValue placeholder={t("settings.selectClientCutoff")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BEFORE_START">{t("settings.clientCutoffBeforeStart")}</SelectItem>
                <SelectItem value="BEFORE_CHECK_IN">{t("settings.clientCutoffBeforeCheckIn")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("settings.clientCancelCutoffModeDesc")}</p>
          </div>
          {mode === "BEFORE_START" && <NumberField field="clientCancelBeforeHours" value={cutoffHours} onChange={setCutoffHours} t={t} />}
        </>}
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">{t("settings.refundPolicyAdminValues")}</p>
        <NumberField field="cancelHours" value={cancelHours} onChange={setCancelHours} t={t} />
        <div className="space-y-1 py-3">
          <label id="early-refund-label" className="text-sm font-medium">{t("settings.freeRefundType")}</label>
          <Select value={refund} onValueChange={(value) => setRefund(value as RefundType)}>
            <SelectTrigger aria-labelledby="early-refund-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL">{t("settings.refundFull")}</SelectItem>
              <SelectItem value="PARTIAL">{t("settings.refundPartial")}</SelectItem>
              <SelectItem value="NONE">{t("settings.refundNone")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {refund === "PARTIAL" && <NumberField field="earlyRefundPercent" value={earlyPercent} onChange={setEarlyPercent} t={t} max={100} />}
        <NumberField field="lateRefundPercent" value={latePercent} onChange={setLatePercent} t={t} max={100} />
        {!enabled && <SwitchRow label={t("settings.requireCancelApproval")} desc={t("settings.requireCancelApprovalDesc")}
          checked={approval} onChange={setApproval} />}
        <SwitchRow label={t("settings.autoRefund")} desc={t(enabled ? "settings.clientAutoRefundDesc" : "settings.autoRefundDesc")}
          checked={autoRefund} onChange={setAutoRefund} />
      </div>
      {invalid && <p role="alert" className="text-sm text-destructive">{t(missingCutoff ? "settings.clientCutoffRequired" : missingEarly ? "settings.earlyPercentRequired" : "settings.invalidCancellationNumbers")}</p>}
      <div className="mt-auto flex justify-end pt-2">
        <Button size="sm" disabled={pending || invalid} onClick={submit}>{t("settings.save")}</Button>
      </div>
    </div>
  )
}
