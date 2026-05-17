"use client"

import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, UserSwitchIcon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchBookingFlowOrder } from "@/lib/api/organization-settings"
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
import { useWizardState } from "./use-wizard-state"
import type { WizardStep } from "./use-wizard-state"
import { ClientStep } from "./booking-client-step"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepChoosePath } from "./wizard-steps/step-choose-path"
import type { BookingPath } from "./wizard-steps/step-choose-path"
import { StepScheduling } from "./wizard-steps/step-scheduling"
import { StepConfirm } from "./wizard-steps/step-confirm"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings } from "@/hooks/use-organization-settings"
import { cn } from "@/lib/utils"

/* ─── Props ─── */

interface BookingWizardProps {
  onSuccess: () => void
  onClose: () => void
}

/* ─── Step rail ─── */

function StepRail({
  current,
  labels,
}: {
  current: number
  labels: string[]
}) {
  return (
    <ol className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1">
      {labels.map((label, i) => {
        const stepNo = i + 1
        const isCurrent = stepNo === current
        const isDone = stepNo < current
        return (
          <li key={label + i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                isCurrent && "bg-primary text-primary-foreground",
                isDone && "bg-primary/15 text-primary",
                !isCurrent && !isDone && "bg-muted text-muted-foreground",
              )}
            >
              {isDone ? "✓" : stepNo}
            </span>
            <span
              className={cn(
                "text-sm transition-colors whitespace-nowrap",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ─── Step labels helper ─── */

function useStepLabels(
  flowOrder: BookingFlowOrder,
  chosenPath: BookingPath | null,
  t: (k: string) => string,
): string[] {
  const effective =
    flowOrder === "both" && chosenPath
      ? chosenPath
      : flowOrder === "both"
      ? "service_first"
      : flowOrder

  const step2 =
    flowOrder === "both" && chosenPath === null
      ? t("bookings.wizard.stepLabel.choosePath")
      : effective === "service_first"
      ? t("bookings.wizard.stepLabel.service")
      : t("bookings.wizard.stepLabel.employee")

  return [
    t("bookings.wizard.stepLabel.client"),
    step2,
    t("bookings.wizard.stepLabel.scheduling"),
    t("bookings.wizard.stepLabel.confirm"),
  ]
}

/* ─── Inner wizard (receives resolved flowOrder) ─── */

function WizardInner({
  flowOrder,
  onSuccess,
  onClose,
}: {
  flowOrder: BookingFlowOrder
  onSuccess: () => void
  onClose: () => void
}) {
  const { t } = useLocale()
  const wizard = useWizardState(flowOrder)
  const { state, effectiveFlow } = wizard
  const { createMut } = useBookingMutations()

  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]
  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90

  const stepLabels = useStepLabels(flowOrder, state.chosenPath, t)

  const handleSubmit = async () => {
    if (
      !state.clientId ||
      !state.serviceId ||
      !state.employeeId ||
      !state.type ||
      !state.date ||
      !state.startTime
    )
      return

    try {
      await createMut.mutateAsync({
        clientId: state.clientId ?? undefined,
        employeeId: state.employeeId,
        serviceId: state.serviceId,
        type: state.type,
        durationOptionId: state.durationOptionId ?? undefined,
        date: state.date,
        startTime: state.startTime,
        payAtClinic: state.payAtClinic,
        branchId: mainBranch?.id,
        couponCode: state.couponCode ?? undefined,
      })
      wizard.reset()
      onSuccess()
    } catch {
      toast.error(t("bookings.wizard.submitError"))
    }
  }

  // Determine if we're in "both" mode path-chooser phase
  const isBothMode = flowOrder === "both"
  const showPathChooser = isBothMode && state.chosenPath === null && state.step === 2

  return (
    <div className="flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
        {/* Left: back button or close */}
        {state.step > 1 ? (
          <Button variant="ghost" size="icon-sm" type="button" onClick={wizard.goBack} className="shrink-0">
            <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
            <span className="sr-only">{t("bookings.wizard.back")}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" type="button" onClick={onClose} className="shrink-0">
            <span className="text-base leading-none">✕</span>
            <span className="sr-only">{t("bookings.wizard.close")}</span>
          </Button>
        )}

        {/* Right: change client button or empty */}
        {state.step > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => wizard.jumpToStep(1)}
            className="shrink-0 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={UserSwitchIcon} size={14} />
            {t("bookings.wizard.changeClient")}
          </Button>
        ) : (
          <div className="w-[88px]" />
        )}
      </div>

      {/* ── Body: two columns ── */}
      <div className="flex flex-col gap-0 md:flex-row">
        {/* Step rail */}
        <aside className="shrink-0 border-b border-border md:w-64 md:border-b-0 md:border-e md:border-border bg-surface/50 px-6 py-6">
          <StepRail current={state.step} labels={stepLabels} />
        </aside>

        {/* Content area */}
        <div className="flex-1 px-6 py-6 md:px-8 md:py-8 min-h-[420px] overflow-y-auto">
          {state.step === 1 && (
            <ClientStep onSelect={wizard.selectClient} />
          )}

          {/* Step 2: path chooser (both mode) OR first selection step */}
          {state.step === 2 && showPathChooser && (
            <StepChoosePath onSelect={(path: BookingPath) => wizard.choosePath(path)} />
          )}

          {state.step === 2 && !showPathChooser && effectiveFlow === "service_first" && (
            <StepService onSelect={wizard.selectService} />
          )}

          {state.step === 2 && !showPathChooser && effectiveFlow === "employee_first" && (
            <StepEmployee
              serviceId={state.serviceId ?? ""}
              onSelect={wizard.selectEmployee}
            />
          )}

          {state.step === 3 && (
            <StepScheduling
              serviceId={state.serviceId ?? ""}
              state={state}
              onSelectEmployee={wizard.selectEmployee}
              onSelectType={(type: string) => wizard.selectType(type as "in_person" | "online" | "walk_in")}
              onSelectDuration={wizard.selectDuration}
              onSkipDuration={wizard.skipDuration}
              onSelectDate={wizard.selectDate}
              onSelectTime={wizard.selectTime}
              maxAdvanceDays={maxAdvanceDays}
            />
          )}

          {state.step === 4 && (
            <StepConfirm
              state={state}
              submitting={createMut.isPending}
              onJump={(step: WizardStep) => wizard.jumpToStep(step)}
              onSubmit={handleSubmit}
              onTogglePayAtClinic={wizard.setPayAtClinic}
              onCouponChange={wizard.setCouponCode}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Outer wrapper — fetches flow order ─── */

export function BookingWizard({ onSuccess, onClose }: BookingWizardProps) {
  const { data: flowOrder = "service_first", isLoading } = useQuery({
    queryKey: queryKeys.organizationSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="h-14 border-b border-border animate-pulse bg-muted/30" />
        <div className="flex flex-col gap-0 md:flex-row">
          <div className="shrink-0 border-b border-border md:w-64 md:border-b-0 md:border-e md:border-border bg-surface/50 px-6 py-6">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`rail-skel-${i}`} className="h-10 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          <div className="flex-1 px-6 py-6 md:px-8 md:py-8">
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`content-skel-${i}`} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <WizardInner flowOrder={flowOrder} onSuccess={onSuccess} onClose={onClose} />
}
