"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { UserGroupIcon } from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { usePrograms, useEnrollClientInProgram } from "@/hooks/use-programs"
import { showApiError } from "@/lib/mutation-helpers"
import { formatPrice } from "@/lib/money"
import { formatLocaleDate } from "@/lib/date"
import { toast } from "sonner"
import type { ProgramStatus, ProgramSummary } from "@/lib/types/program"

/**
 * StepProgram — GROUP-track wizard step.
 *
 * Lists bookable group programs and enrolls the operator-selected client
 * into the chosen one. Group enrollment is single-shot: the program itself
 * carries startDate / daysCount / hoursPerDay, so there is no practitioner,
 * duration, or slot sub-flow.
 */

/* ─── Enrollable status set ──────────────────────────────────────────
 * The backend enrollment handler (apps/backend/src/modules/bookings/
 * enroll-in-program/enroll-in-program.handler.ts:66) gates enrollment
 * through `isProgramOpenForEnrollment(program.status)` defined in
 * apps/backend/src/modules/bookings/program/program-state-machine.ts:89:
 *
 *   return status === ProgramStatus.OPEN || status === ProgramStatus.MIN_REACHED;
 *
 * The atomic capacity increment on the same path (handler.ts:107-114)
 * also filters `status: { in: [OPEN, MIN_REACHED] }`. So this client-side
 * set MUST match exactly or we offer programs the server will reject.
 */
const ENROLLABLE_STATUSES: ReadonlySet<ProgramStatus> = new Set([
  "OPEN",
  "MIN_REACHED",
])

function isEnrollable(p: ProgramSummary): boolean {
  return ENROLLABLE_STATUSES.has(p.status)
}

function isProgramFull(p: ProgramSummary): boolean {
  return p.isFull ?? p.enrolledCount >= p.maxParticipants
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function StepProgramSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="h-24 animate-pulse rounded-2xl bg-muted"
        />
      ))}
    </div>
  )
}

/* ─── Step component ───────────────────────────────────────────────── */

export interface StepProgramProps {
  clientId: string
  selectedProgramId: string | null
  onEnrolled: (programId: string, programName: string) => void
}

export function StepProgram(props: StepProgramProps): JSX.Element {
  const { t, locale } = useLocale()

  // Fetch broadly (no status filter — the hook only accepts a single
  // status, but the enrollable set has two). We then filter client-side
  // to the statuses the backend handler accepts.
  const { data, isLoading } = usePrograms({})

  const enroll = useEnrollClientInProgram()
  const enrolling = enroll.isPending

  if (isLoading) return <StepProgramSkeleton />

  const programs = (data ?? []).filter(isEnrollable)

  if (programs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("bookings.pos.program.empty")}
      </p>
    )
  }

  const handleEnroll = (program: ProgramSummary) => {
    if (enrolling) return
    enroll.mutate(
      { programId: program.id, clientId: props.clientId },
      {
        onSuccess: () => {
          const resolvedName =
            locale === "en" && program.nameEn ? program.nameEn : program.nameAr
          toast.success(t("bookings.pos.program.enroll.success"))
          props.onEnrolled(program.id, resolvedName)
        },
        onError: (err) => {
          showApiError(err, {
            fallback: t("bookings.pos.program.enroll.error"),
            t,
          })
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {enrolling && (
        <p
          aria-live="polite"
          className="text-center text-xs font-normal text-muted-foreground"
        >
          {t("bookings.pos.program.enrolling")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {programs.map((program) => {
          const name =
            locale === "en" && program.nameEn
              ? program.nameEn
              : program.nameAr
          const full = isProgramFull(program)
          const disabled = full || enrolling
          const seats = t("bookings.pos.program.seats")
            .replace("{enrolled}", String(program.enrolledCount))
            .replace("{max}", String(program.maxParticipants))
          const startLine =
            program.startDate == null
              ? t("bookings.pos.program.notScheduled")
              : `${t("bookings.pos.program.startDate")} ${formatLocaleDate(program.startDate, locale)}`

          return (
            <WizardCard
              key={program.id}
              onClick={() => handleEnroll(program)}
              selected={program.id === props.selectedProgramId}
              disabled={disabled}
              disabledReason={full ? t("bookings.pos.program.full") : undefined}
              className="px-4 py-3.5"
            >
              <div className="flex items-start gap-3 text-start">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    size={18}
                    className="text-primary"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {name}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground tabular-nums">
                    {seats}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {startLine}
                  </span>
                  <span className="truncate text-xs font-normal text-muted-foreground tabular-nums">
                    {formatPrice(Number(program.price))} {t("programs.currency.SAR")}
                  </span>
                </div>
              </div>
            </WizardCard>
          )
        })}
      </div>
    </div>
  )
}
