"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Separator } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { fetchBookingSettings } from "@/lib/api/booking-settings"

import { OverrideField, SwitchField } from "./booking-settings-fields"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "./create/form-schema"

interface Props {
  form: UseFormReturn<CreateServiceFormData>
  locale?: string
}

export function ServiceBookingSettings({ form, locale: _locale }: Props) {
  const [open, setOpen] = useState(false)
  const { t } = useLocale()
  const { data: globalSettings } = useQuery({
    queryKey: ["booking-settings"],
    queryFn: fetchBookingSettings,
    staleTime: 5 * 60 * 1000,
  })

  const globalMinLead = globalSettings?.minBookingLeadMinutes ?? 0
  const globalBuffer = globalSettings?.bufferMinutes ?? 0
  const globalMaxAdvanceDays = globalSettings?.maxAdvanceBookingDays ?? 60

  return (
    <div className="space-y-3">
      <Separator />
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between p-0 text-sm font-medium text-foreground hover:bg-transparent"
        onClick={() => setOpen(!open)}
      >
        {t("services.booking.title")}
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className={`size-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
          {/* Row 1: Buffer Before + Min Lead */}
          <OverrideField
            id="sbs-buffer-before"
            label={t("services.booking.bufferBefore.label")}
            description={t("services.booking.bufferBefore.desc")}
            value={form.watch("bufferBeforeMinutes")}
            defaultValue={globalBuffer}
            unit="min"
            globalHint={t("services.booking.globalPrefix") + globalBuffer + t("services.booking.minUnit")}
            min={0}
            max={120}
            onEnable={() => form.setValue("bufferBeforeMinutes", globalBuffer)}
            onDisable={() => form.setValue("bufferBeforeMinutes", null)}
            onChange={(v) => form.setValue("bufferBeforeMinutes", v)}
          />
          <OverrideField
            id="sbs-min-lead"
            label={t("services.booking.minLead.label")}
            description={t("services.booking.minLead.desc")}
            value={form.watch("minLeadMinutes")}
            defaultValue={globalMinLead}
            unit="min"
            globalHint={t("services.booking.globalPrefix") + globalMinLead + t("services.booking.minUnit")}
            min={0}
            max={1440}
            onEnable={() => form.setValue("minLeadMinutes", 60)}
            onDisable={() => form.setValue("minLeadMinutes", null)}
            onChange={(v) => form.setValue("minLeadMinutes", v)}
          />

          {/* Row 2: Max Advance + Deposit */}
          <OverrideField
            id="sbs-max-advance"
            label={t("services.booking.maxAdvance.label")}
            description={t("services.booking.maxAdvance.desc")}
            value={form.watch("maxAdvanceDays")}
            defaultValue={globalMaxAdvanceDays}
            unit={t("services.booking.days")}
            globalHint={t("services.booking.globalPrefix") + globalMaxAdvanceDays + t("services.booking.dayUnit")}
            min={1}
            max={365}
            onEnable={() => form.setValue("maxAdvanceDays", 30)}
            onDisable={() => form.setValue("maxAdvanceDays", null)}
            onChange={(v) => form.setValue("maxAdvanceDays", v)}
          />
          <OverrideField
            id="sbs-deposit"
            label={t("services.booking.deposit.label")}
            description={t("services.booking.deposit.desc")}
            value={form.watch("depositEnabled") ? (form.watch("depositAmount") ?? null) : null}
            defaultValue={0}
            unit=""
            globalHint={t("services.booking.disabledDefault")}
            min={0}
            max={undefined}
            onEnable={() => { form.setValue("depositEnabled", true); form.setValue("depositAmount", null) }}
            onDisable={() => { form.setValue("depositEnabled", false); form.setValue("depositAmount", null) }}
            onChange={(v) => form.setValue("depositAmount", v ?? null)}
          />

          {/* Row 3: Max Participants + Recurring */}
          <OverrideField
            id="sbs-max-participants"
            label={t("services.booking.maxParticipants.label")}
            description={t("services.booking.maxParticipants.desc")}
            value={(form.watch("maxParticipants") ?? 1) > 1 ? form.watch("maxParticipants") : null}
            defaultValue={1}
            unit=""
            globalHint={t("services.booking.maxParticipants.hint")}
            min={1}
            max={100}
            onEnable={() => form.setValue("maxParticipants", 2)}
            onDisable={() => form.setValue("maxParticipants", 1)}
            onChange={(v) => form.setValue("maxParticipants", v ?? 1)}
          />
          <SwitchField
            id="sbs-recurring"
            label={t("services.booking.recurring.label")}
            checked={form.watch("allowRecurring") ?? false}
            onCheckedChange={(v) => form.setValue("allowRecurring", v)}
          />

          {/* Buffer After — full width */}
          <OverrideField
            id="sbs-buffer-after"
            label={t("services.booking.bufferAfter.label")}
            description={t("services.booking.bufferAfter.desc")}
            value={form.watch("bufferAfterMinutes")}
            defaultValue={globalBuffer}
            unit="min"
            globalHint={t("services.booking.globalPrefix") + globalBuffer + t("services.booking.minUnit")}
            min={0}
            max={120}
            onEnable={() => form.setValue("bufferAfterMinutes", globalBuffer)}
            onDisable={() => form.setValue("bufferAfterMinutes", null)}
            onChange={(v) => form.setValue("bufferAfterMinutes", v)}
          />
        </div>
      )}
    </div>
  )
}
