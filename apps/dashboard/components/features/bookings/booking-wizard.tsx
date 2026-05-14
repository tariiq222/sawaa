"use client"

import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, UserSwitchIcon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
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
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { StepConfirm } from "./wizard-steps/step-confirm"
import { useBookingMutations } from "@/hooks/use-bookings"
import { cn } from "@/lib/utils"

/* ─── Props ─── */

interface BookingWizardProps {
  onSuccess: () => void
  onClose: () => void
}

/* ─── Step dots indicator ─── */

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={`dot-${i}`}
          className={cn(
            "block rounded-full transition-all duration-200",
            i + 1 === current
              ? "h-2.5 w-8 bg-primary"
              : i + 1 < current
              ? "h-2.5 w-2.5 bg-primary/50"
              : "h-2.5 w-2.5 bg-border",
          )}
        />
      ))}
    </div>
  )
}

/* ─── Step title map ─── */

function useStepTitle(
  step: WizardStep,
  flowOrder: BookingFlowOrder,
  chosenPath: BookingPath | null,
  t: (k: string) => string,
): string {
  // In "both" mode with no path chosen yet → show chooser title
  if (flowOrder === "both" && chosenPath === null) {
    const map: Record<WizardStep, string> = {
      1: t("bookings.wizard.stepLabel.client"),
      2: t("bookings.wizard.stepLabel.choosePath"),
      3: "",
      4: t("bookings.wizard.stepLabel.typeDuration"),
      5: t("bookings.wizard.stepLabel.datetime"),
      6: t("bookings.wizard.stepLabel.confirm"),
    }
    return map[step]
  }

  // Resolve effective flow for title purposes
  const effective = flowOrder === "both" && chosenPath ? chosenPath : flowOrder === "both" ? "service_first" : flowOrder

  const map: Record<WizardStep, string> = {
    1: t("bookings.wizard.stepLabel.client"),
    2: effective === "service_first"
      ? t("bookings.wizard.stepLabel.service")
      : t("bookings.wizard.stepLabel.employee"),
    3: effective === "service_first"
      ? t("bookings.wizard.stepLabel.employee")
      : t("bookings.wizard.stepLabel.service"),
    4: t("bookings.wizard.stepLabel.typeDuration"),
    5: t("bookings.wizard.stepLabel.datetime"),
    6: t("bookings.wizard.stepLabel.confirm"),
  }
  return map[step]
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

  const stepTitle = useStepTitle(state.step, flowOrder, state.chosenPath, t)

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
      {/* ── Sticky header ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
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

        {/* Center: step title */}
        <p className="flex-1 text-center text-base font-bold text-foreground">
          {stepTitle}
        </p>

        {/* Right: change client or spacer */}
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

      {/* ── Step dots ── */}
      <div className="px-5 pt-5 pb-1">
        <StepDots current={state.step} total={6} />
      </div>

      {/* ── Step content ── */}
      <div className="px-5 pt-4 pb-6 min-h-[280px] overflow-y-auto max-h-[calc(90vh-140px)]">
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

        {state.step === 3 && effectiveFlow === "service_first" && (
          <StepEmployee
            serviceId={state.serviceId!}
            onSelect={wizard.selectEmployee}
          />
        )}

        {state.step === 3 && effectiveFlow === "employee_first" && (
          <StepService onSelect={wizard.selectService} />
        )}

        {state.step === 4 && (
          <StepTypeDuration
            employeeId={state.employeeId!}
            serviceId={state.serviceId!}
            selectedType={state.type}
            selectedDurationOptionId={state.durationOptionId}
            onSelectType={(type: string) =>
              wizard.selectType(type as "in_person" | "online" | "walk_in")
            }
            onSelectDuration={wizard.selectDuration}
            onSkipDuration={wizard.skipDuration}
          />
        )}

        {state.step === 5 && (
          <StepDatetime
            employeeId={state.employeeId!}
            serviceId={state.serviceId!}
            bookingType={state.type ?? "in_person"}
            durationOptionId={state.durationOptionId}
            selectedDate={state.date}
            selectedTime={state.startTime}
            onSelectDate={wizard.selectDate}
            onSelectTime={wizard.selectTime}
          />
        )}

        {state.step === 6 && (
          <StepConfirm
            state={state}
            submitting={createMut.isPending}
            onJump={(step: WizardStep) => wizard.jumpToStep(step)}
            onSubmit={handleSubmit}
            onTogglePayAtClinic={wizard.setPayAtClinic}
          />
        )}
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
      <div className="flex flex-col gap-3">
        <div className="h-6 w-48 animate-pulse rounded bg-muted mx-auto" />
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`dot-${i}`} className="h-2 w-2 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return <WizardInner flowOrder={flowOrder} onSuccess={onSuccess} onClose={onClose} />
}
