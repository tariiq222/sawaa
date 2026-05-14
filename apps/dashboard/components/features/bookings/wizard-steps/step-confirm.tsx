"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import { useOrganizationConfig } from "@/hooks/use-organization-config"
import type { WizardState, WizardStep } from "../use-wizard-state"

/* ─── Types ─── */

interface StepConfirmProps {
  state: WizardState
  submitting: boolean
  onJump: (step: WizardStep) => void
  onSubmit: () => void
  onTogglePayAtClinic: (value: boolean) => void
}

interface SummaryRowProps {
  label: string
  value: string
  onEdit: () => void
}

/* ─── Summary row ─── */

function SummaryRow({ label, value, onEdit }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground text-end">{value}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          type="button"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
        </Button>
      </div>
    </div>
  )
}

/* ─── Pay at clinic option ─── */

interface PayAtClinicOptionProps {
  selected: boolean
  label: string
  description: string
  onSelect: () => void
}

function PayAtClinicOption({ selected, label, description, onSelect }: PayAtClinicOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-5 text-start transition-all",
        selected
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface hover:bg-muted/50",
      )}
    >
      {/* Radio indicator */}
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          selected ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {selected && (
          <div className="size-3 rounded-full bg-primary" />
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
    </button>
  )
}

/* ─── Type label helper ─── */

function getTypeLabel(type: string | null, t: (key: string) => string): string {
  if (!type) return "—"
  const map: Record<string, string> = {
    in_person: t("bookings.wizard.step.typeDuration.inPerson"),
    online: t("bookings.wizard.step.typeDuration.online"),
    walk_in: t("bookings.wizard.step.typeDuration.walkIn"),
  }
  return map[type] ?? type
}

/* ─── Main step ─── */

export function StepConfirm({
  state,
  submitting,
  onJump,
  onSubmit,
  onTogglePayAtClinic,
}: StepConfirmProps) {
  const { t } = useLocale()
  const { formatDate, formatTime } = useOrganizationConfig()

  const dateLabel = state.date
    ? formatDate(state.date + "T00:00:00")
    : "—"

  const datetimeValue = state.startTime
    ? `${dateLabel} · ${formatTime(state.startTime)}`
    : dateLabel

  const typeValue = [
    getTypeLabel(state.type, t),
    state.durationLabel ?? null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="flex flex-col gap-5">
      {/* Summary section */}
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("bookings.wizard.step.confirm.summaryHeader")}
      </p>
      <div className="rounded-xl border border-border bg-surface px-4">
        <SummaryRow
          label={t("bookings.wizard.step.confirm.client")}
          value={state.clientName ?? "—"}
          onEdit={() => onJump(1)}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.service")}
          value={state.serviceName ?? "—"}
          onEdit={() => onJump(2)}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.employee")}
          value={state.employeeName ?? "—"}
          onEdit={() => onJump(3)}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.type")}
          value={typeValue || "—"}
          onEdit={() => onJump(4)}
        />
        <div className="border-t border-border/60" />
        <SummaryRow
          label={t("bookings.wizard.step.confirm.datetime")}
          value={datetimeValue}
          onEdit={() => onJump(5)}
        />
      </div>

      {/* Payment section */}
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("bookings.wizard.step.confirm.paymentHeader")}
      </p>
      <PayAtClinicOption
        selected={state.payAtClinic}
        label={t("bookings.wizard.step.confirm.payAtClinic")}
        description={t("bookings.wizard.step.confirm.payAtClinicDescription")}
        onSelect={() => onTogglePayAtClinic(!state.payAtClinic)}
      />

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        onClick={onSubmit}
        disabled={submitting}
        type="button"
      >
        {t("bookings.wizard.step.confirm.submit")}
      </Button>
    </div>
  )
}
