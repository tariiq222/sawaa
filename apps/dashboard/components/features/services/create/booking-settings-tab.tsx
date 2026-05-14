"use client"

import { useQuery } from "@tanstack/react-query"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { fetchBookingSettings, RECURRING_PATTERNS } from "@/lib/api/booking-settings"

import { queryKeys } from "@/lib/query-keys"
import { OverrideField } from "../booking-settings-fields"
import { cn } from "@/lib/utils"
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
    allowRecurring,
    allowedRecurringPatterns,
    maxRecurrences,
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
    <Card>
      <CardHeader>
        <CardTitle>{t("services.create.tabs.booking")}</CardTitle>
        <CardDescription>
          {t("services.create.tabs.bookingDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Row 1: Buffer + Min Lead */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        {/* Row 3: Max Participants + Recurring toggle (with inline pattern expansion) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          {/* Recurring: switch card + pattern picker expand inside the same visual container */}
          <div className={cn(
              "space-y-3 rounded-lg border p-3 transition-colors duration-200",
              allowRecurring
                ? "border-primary/30 bg-primary/[0.03]"
                : "border-border bg-background",
            )}>
              {/* Toggle header */}
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="create-recurring-toggle" className="cursor-pointer text-sm">
                  {t("services.booking.recurring.label")}
                </Label>
                <Switch
                  id="create-recurring-toggle"
                  checked={allowRecurring ?? false}
                  onCheckedChange={(v) => form.setValue("allowRecurring", v)}
                />
              </div>
              {allowRecurring !== false && (
                <p className="text-xs text-muted-foreground/70">
                  {t("services.booking.recurring.desc")}
                </p>
              )}

              {/* Pattern picker — shown when recurring is enabled */}
              {allowRecurring && (
                <div className="space-y-3 border-t border-primary/20 pt-3">
                  <p className="text-xs text-muted-foreground">
                    {t("services.booking.recurring.patterns")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {RECURRING_PATTERNS.map((p) => {
                      const selected = (allowedRecurringPatterns ?? []).includes(p.value)
                      const togglePattern = () => {
                        // Single-select: replace the array with only this pattern.
                        // Once a pattern is selected it cannot be deselected (radio behaviour).
                        if (!selected) {
                          form.setValue("allowedRecurringPatterns", [p.value])
                        }
                      }
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={togglePattern}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                            selected
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted cursor-pointer",
                          )}
                        >
                          {t(p.labelKey)}
                        </button>
                      )
                    })}
                  </div>
                  {(allowedRecurringPatterns ?? []).length > 0 && (
                    <div className="space-y-1.5 border-t border-primary/20 pt-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="create-max-recurrences" className="text-xs">
                          {t("services.booking.recurring.maxLabel")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="create-max-recurrences"
                            type="number"
                            value={maxRecurrences ?? 12}
                            onChange={(e) => form.setValue("maxRecurrences", Number(e.target.value) || 12)}
                            className="w-20 tabular-nums"
                            min={1}
                            max={52}
                          />
                          <span className="text-xs text-muted-foreground">{t("services.booking.recurring.appts")}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t("services.booking.recurring.example")}
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
