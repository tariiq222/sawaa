"use client"

import { useQuery } from "@tanstack/react-query"
import { useLocale } from "@/components/locale-provider"
import { fetchBookingSettings } from "@/lib/api/booking-settings"
import { FormSection } from "@/components/features/shared/form-section"
import { queryKeys } from "@/lib/query-keys"
import { OverrideField, NumberField, SwitchField } from "../booking-settings-fields"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "./form-schema"

/* ─── Props ─── */

interface BookingSettingsTabProps {
  form: UseFormReturn<CreateServiceFormData>
}

/* ─── Component ─── */

export function BookingSettingsTab({ form }: BookingSettingsTabProps) {
  const { t } = useLocale()

  const {
    bufferMinutes,
    minLeadMinutes,
    maxAdvanceDays,
    depositEnabled,
    depositAmount,
    maxParticipants,
    minParticipants,
    reserveWithoutPayment,
  } = form.watch()

  const { data: globalSettings } = useQuery({
    queryKey: queryKeys.bookingSettings.detail(),
    queryFn: fetchBookingSettings,
    staleTime: 5 * 60 * 1000,
  })

  const globalMinLead = globalSettings?.minBookingLeadMinutes ?? 0
  const globalBuffer = globalSettings?.bufferMinutes ?? 0
  const globalMaxAdvanceDays = globalSettings?.maxAdvanceBookingDays ?? 60

  return (
    <FormSection title={t("services.create.tabs.booking")}>
      <p className="mb-4 text-sm text-muted-foreground">{t("services.create.tabs.bookingDesc")}</p>
      <div className="space-y-4">
        {/* Row 1: Buffer + Min Lead */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverrideField
            id="create-buffer"
            label={t("services.booking.buffer.label")}
            description={t("services.booking.buffer.desc")}
            value={(bufferMinutes ?? 0) > 0 ? bufferMinutes : null}
            defaultValue={globalBuffer}
            unit="min"
            globalHint={t("services.booking.globalPrefix") + globalBuffer + t("services.booking.minUnit")}
            min={0}
            max={120}
            onEnable={() => form.setValue("bufferMinutes", globalBuffer > 0 ? globalBuffer : 15)}
            onDisable={() => form.setValue("bufferMinutes", 0)}
            onChange={(v) => form.setValue("bufferMinutes", v ?? undefined)}
          />
          <OverrideField
            id="create-min-lead"
            label={t("services.booking.minLead.label")}
            description={t("services.booking.minLead.desc")}
            value={minLeadMinutes}
            defaultValue={globalMinLead}
            unit="min"
            globalHint={t("services.booking.globalPrefix") + globalMinLead + t("services.booking.minUnit")}
            min={0}
            max={1440}
            onEnable={() => form.setValue("minLeadMinutes", 60)}
            onDisable={() => form.setValue("minLeadMinutes", null)}
            onChange={(v) => form.setValue("minLeadMinutes", v ?? null)}
          />
        </div>

        {/* Row 2: Max Advance + Deposit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <OverrideField
            id="create-max-advance"
            label={t("services.booking.maxAdvance.label")}
            description={t("services.booking.maxAdvance.desc")}
            value={maxAdvanceDays}
            defaultValue={globalMaxAdvanceDays}
            unit={t("services.booking.days")}
            globalHint={t("services.booking.globalPrefix") + globalMaxAdvanceDays + t("services.booking.dayUnit")}
            min={1}
            max={365}
            onEnable={() => form.setValue("maxAdvanceDays", 30)}
            onDisable={() => form.setValue("maxAdvanceDays", null)}
            onChange={(v) => form.setValue("maxAdvanceDays", v ?? null)}
          />
          <OverrideField
            id="create-deposit"
            label={t("services.booking.deposit.label")}
            description={t("services.booking.deposit.desc")}
            value={depositEnabled ? (depositAmount ?? null) : null}
            defaultValue={0}
            unit=""
            globalHint={t("services.booking.disabledDefault")}
            min={0}
            max={undefined}
            onEnable={() => { form.setValue("depositEnabled", true); form.setValue("depositAmount", null) }}
            onDisable={() => { form.setValue("depositEnabled", false); form.setValue("depositAmount", null) }}
            onChange={(v) => form.setValue("depositAmount", v ?? null)}
          />
        </div>

        {/* Row 3: Max Participants */}
        <OverrideField
          id="create-max-participants"
          label={t("services.booking.maxParticipants.label")}
          description={t("services.booking.maxParticipants.desc")}
          value={(maxParticipants ?? 1) > 1 ? maxParticipants : null}
          defaultValue={1}
          unit=""
          globalHint={t("services.booking.maxParticipants.hint")}
          min={1}
          max={100}
          onEnable={() => form.setValue("maxParticipants", 2)}
          onDisable={() => form.setValue("maxParticipants", 1)}
          onChange={(v) => form.setValue("maxParticipants", v ?? 1)}
        />

        {(maxParticipants ?? 1) > 1 && (
          <div className="space-y-4 ps-1">
            <NumberField
              id="create-min-participants"
              label={t("services.booking.minParticipants.label")}
              value={minParticipants ?? 1}
              onChange={(v) => form.setValue("minParticipants", v ?? undefined)}
              unit=""
              min={1}
              max={maxParticipants ?? 100}
              hint={t("services.booking.minParticipants.desc")}
            />
            <SwitchField
              id="create-reserve-without-payment"
              label={t("services.booking.reserveWithoutPayment.label")}
              description={t("services.booking.reserveWithoutPayment.desc")}
              checked={reserveWithoutPayment ?? false}
              onCheckedChange={(v) => form.setValue("reserveWithoutPayment", v)}
            />
          </div>
        )}

      </div>
    </FormSection>
  )
}
