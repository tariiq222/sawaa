"use client"

// EXCEPTION: feature-component size limit (300) and absolute file size
// limit (350) exceeded — 2026-06-24 — Phase 3 of session-packages
// rebuild wired the auto-detect "احجز من الرصيد" badge + from-credit
// submit path into this wizard. Task 5 (2026-06-25) added the client
// credits panel below the client step. Splitting the wizard mid-refactor
// would risk breaking the auto-advance section navigation; the
// alternative (extracting a credit-mode wrapper) is deferred to a
// follow-up. Once the badge code stabilises this file can be split
// into booking-pos-shell.tsx + booking-pos-credit-mode.tsx.

import { useState, useMemo, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings } from "@/hooks/use-organization-settings"
import { useBookingMutations } from "@/hooks/use-bookings"
import { useBookFromCredit } from "@/hooks/use-credit-bookings"
import { queryKeys } from "@/lib/query-keys"
import { fetchServices } from "@/lib/api/services"
import { fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"
import type { EmployeeServiceType } from "@/lib/types/employee"
import { showApiError } from "@/lib/mutation-helpers"
import { combineDateTimeToISO } from "@/lib/utils"
import { bookingPosPayloadSchema } from "@/lib/schemas/booking.schema"

import { ClientStep } from "./booking-client-step"
import { ClientCreditsPanel } from "./client-credits-panel"
import type { CreditTarget } from "./use-booking-form-state"
import { StepDepartment } from "./wizard-steps/step-department"
import { StepCategory } from "./wizard-steps/step-category"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"
import { BookingSummary } from "./booking-summary"
import { MatchingCreditBadge } from "./matching-credit-badge"
import { useBookingFormState } from "./use-booking-form-state"
import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"

/* ─── Pure helpers ─── */

/**
 * When the operator switches delivery type, preserve an already-set
 * durationOptionId if it still exists among the new serviceType's options.
 * Falls back to `defaultId` (the type's default/first option) otherwise.
 * Returns `defaultId` when `currentId` is null (normal non-credit flow).
 */
export function resolvePreservedDurationOptionId(
  currentId: string | null,
  serviceType: import("@/lib/types/employee").EmployeeServiceType | undefined,
  defaultId: string | null,
): string | null {
  if (!currentId) return defaultId
  const options = serviceType?.durationOptions ?? []
  const stillPresent = options.some((o) => o.id === currentId)
  return stillPresent ? currentId : defaultId
}

/* ─── Props ─── */

interface BookingPosProps {
  onSuccess: () => void
  onCancel: () => void
}

/* ─── Main component ─── */

export function BookingPos({ onSuccess, onCancel }: BookingPosProps) {
  const { t, locale } = useLocale()
  const [openSection, setOpenSection] = useState<SectionId>("client")

  // Phase 3 — "احجز من الرصيد" toggle. When true, submit posts to
  // /dashboard/bookings/from-credit instead of /dashboard/bookings,
  // consuming the oldest matching credit. Reset whenever the operator
  // changes client/service/employee/duration — re-selecting should
  // always start from a fresh suggestion.
  const [useCredit, setUseCredit] = useState(false)
  // Sticky dismissal for the current selection (param change re-arms).
  const [creditDismissed, setCreditDismissed] = useState(false)

  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]
  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90
  const queryClient = useQueryClient()
  const { createMut } = useBookingMutations()
  const bookFromCreditMut = useBookFromCredit()

  const {
    state,
    isComplete,
    reset,
    selectClient,
    selectDepartment,
    selectCategory,
    selectService,
    selectEmployee,
    selectDeliveryType,
    selectDurationOption,
    selectDate,
    selectTime,
    setPayAtClinic,
    setCouponCode,
    applyCreditTarget,
  } = useBookingFormState()

  // Task 5 — jump to the typeDuration step when the operator selects a
  // credit from the client credits panel.
  const handleUseCredit = (target: CreditTarget) => {
    applyCreditTarget(target)
    setOpenSection("typeDuration")
  }

  // Phase 3 — re-arm the badge when the operator changes any of the
  // four matching-credit params (client/service/employee/duration).
  // Re-selecting clears the dismissal so the badge can suggest again.
  const handleClientSelect = (id: string, name: string) => {
    selectClient(id, name)
    setOpenSection("department")
    setUseCredit(false)
    setCreditDismissed(false)
  }
  const handleDepartmentSelect = (id: string, name: string) => {
    selectDepartment(id, name)
    setOpenSection("category")
  }
  // Service/employee changes invalidate the credit triple → re-arm.
  const handleServiceSelect = (id: string, name: string) => {
    selectService(id, name)
    setOpenSection("employee")
    setUseCredit(false)
    setCreditDismissed(false)
  }
  const handleEmployeeSelect = (id: string, name: string) => {
    selectEmployee(id, name)
    setOpenSection("typeDuration")
    setUseCredit(false)
    setCreditDismissed(false)
  }

  const handleSelectDeliveryType = (
    deliveryType: string,
    durationOptionId: string | null,
  ) => {
    selectDeliveryType(deliveryType.toUpperCase() as "IN_PERSON" | "ONLINE")
    // Preserve an existing credit-driven durationOptionId when it is still
    // valid for the chosen delivery type. Falls back to the default/first
    // option for the new type when null or no longer present.
    const normalizedType = deliveryType.toUpperCase()
    const matchingServiceType = serviceTypes.find(
      (st) => st.deliveryType.toUpperCase() === normalizedType && st.isActive,
    )
    const resolvedId = resolvePreservedDurationOptionId(
      state.durationOptionId,
      matchingServiceType,
      durationOptionId,
    )
    selectDurationOption(resolvedId)
    // When the type has a single duration option the wizard advances
    // straight to date/time; with multiple options the operator stays on
    // this step to pick a duration first.
    const matchHasMultiple = (matchingServiceType?.durationOptions?.length ?? 0) > 1
    setOpenSection(matchHasMultiple ? "typeDuration" : "datetime")
    // DurationOption change re-arms the badge so the new triple can match.
    setUseCredit(false)
    setCreditDismissed(false)
  }

  // Operator picks a specific duration option for the already-selected
  // delivery type. Re-arms the credit badge (the triple changed) and
  // advances to the date/time step.
  const handleSelectDuration = (durationOptionId: string) => {
    selectDurationOption(durationOptionId)
    setOpenSection("datetime")
    setUseCredit(false)
    setCreditDismissed(false)
  }

  /**
   * When a category (clinic) is selected, branch on `category.bookingMode`:
   *   - DIRECT   → the hidden internal service is auto-selected and the
   *                wizard skips straight to the employee step.
   *   - SERVICES → the user always picks a service, even when the category
   *                has only one.
   *   - null (legacy clinics with no `bookingMode`) → behave like SERVICES.
   * If a DIRECT category has no hidden service in the cache (data drift),
   * we fall back to the service step rather than blocking the wizard.
   */
  const handleCategorySelect = useCallback(async (
    id: string,
    name: string,
    bookingMode: "DIRECT" | "SERVICES" | null,
  ) => {
    const filters = { categoryId: id, isActive: true, limit: 100, includeHidden: true }
    const qKey = queryKeys.services.list(filters)

    // Prefer cached data; fall back to a network fetch (TanStack Query dedupes).
    const cached = queryClient.getQueryData<Awaited<ReturnType<typeof fetchServices>>>(qKey)
    const data = cached ?? await queryClient.fetchQuery({
      queryKey: qKey,
      queryFn: () => fetchServices(filters),
      staleTime: 5 * 60 * 1000,
    })

    if (bookingMode === "DIRECT") {
      const hidden = (data?.items ?? []).find((s) => s.isHidden)
      if (hidden) {
        const svcName = locale === "ar" ? hidden.nameAr : (hidden.nameEn ?? hidden.nameAr)
        selectCategory(id, name, "DIRECT", { serviceId: hidden.id, serviceName: svcName })
        setOpenSection("employee")
        return
      }
      // Defensive: DIRECT clinic without a hidden service — fall back to the
      // service step so the operator can still book rather than getting stuck.
      // (Backend should always seed a hidden service for DIRECT clinics.)
    }

    selectCategory(id, name, bookingMode)
    setOpenSection("service")
  }, [queryClient, selectCategory, locale])

  /**
   * True when the service was pre-selected automatically because the chosen
   * category is a DIRECT clinic. In this case the service step is hidden from
   * the wizard — changing the category clears `serviceId` via `selectCategory`.
   */
  const isServiceAutoSelected = useMemo(
    () => state.categoryBookingMode === "DIRECT" && !!state.serviceId,
    [state.categoryBookingMode, state.serviceId],
  )

  // Summary strings for collapsed chips
  const deliveryTypeLabels: Record<string, string> = {
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
  }
  const summaries: Record<SectionId, string | null> = {
    client: state.clientName,
    department: state.departmentName,
    category: state.categoryName,
    service: state.serviceName,
    employee: state.employeeName,
    typeDuration: state.deliveryType
      ? deliveryTypeLabels[state.deliveryType] ?? null
      : null,
    datetime: state.date
      ? state.date + (state.startTime ? ` · ${state.startTime}` : "")
      : null,
  }

  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  const canShowDatetime = Boolean(state.serviceId && state.employeeId && state.deliveryType)

  // Selected service price (halalas) for the summary. Reuses the same cache
  // key as StepTypeDuration so TanStack Query serves it from cache — no extra
  // fetch. EmployeeServiceType.price reflects per-employee overrides and is
  // correct for DIRECT clinics where Service.price is always 0.
  const { data: serviceTypes = [] } = useQuery<EmployeeServiceType[]>({
    queryKey: queryKeys.employees.serviceTypes(state.employeeId ?? "", state.serviceId ?? ""),
    queryFn: () => fetchEmployeeServiceTypes(state.employeeId!, state.serviceId!),
    enabled: !!state.employeeId && !!state.serviceId,
    staleTime: 0,
  })
  const selectedServiceType = useMemo(() => {
    if (!state.deliveryType || serviceTypes.length === 0) return undefined
    return serviceTypes.find(
      (st) => st.deliveryType.toLowerCase() === state.deliveryType?.toLowerCase() && st.isActive,
    )
  }, [serviceTypes, state.deliveryType])

  const selectedDurationOption = useMemo(() => {
    if (!selectedServiceType || !state.durationOptionId) return undefined
    return selectedServiceType.durationOptions?.find((o) => o.id === state.durationOptionId)
  }, [selectedServiceType, state.durationOptionId])

  // Price + duration follow the chosen duration option when present,
  // falling back to the type-level values otherwise.
  const servicePriceHalalas = useMemo(() => {
    if (selectedDurationOption) return Number(selectedDurationOption.price)
    return selectedServiceType?.price != null ? Number(selectedServiceType.price) : null
  }, [selectedServiceType, selectedDurationOption])

  const selectedDurationMins = selectedDurationOption?.durationMinutes ?? null

  const durationSummaryLabel = selectedDurationOption
    ? (locale === "ar"
        ? selectedDurationOption.labelAr ?? selectedDurationOption.label
        : selectedDurationOption.label) ||
      `${selectedDurationOption.durationMinutes} ${t("bookings.wizard.step.typeDuration.minutes")}`
    : null

  const handleSubmit = async () => {
    if (!state.clientId || !state.serviceId || !state.employeeId || !state.deliveryType || !state.date || !state.startTime)
      return

    // Phase 3 — when the operator has accepted "احجز من الرصيد", post to
    // /dashboard/bookings/from-credit with the full triple and let the
    // backend FIFO-select the matching credit. Otherwise fall through to
    // the normal paid booking path.
    if (useCredit) {
      if (!state.durationOptionId || !mainBranch?.id) {
        // Defensive: badge can only appear with the full triple, but if
        // the operator toggled credit mode then changed a param, the
        // triple may have been cleared. Surface as a generic submit
        // error rather than silently no-op'ing.
        toast.error(t("bookings.wizard.submitError"))
        return
      }
      const scheduledAt = combineDateTimeToISO(state.date, state.startTime)
      if (!scheduledAt) {
        toast.error(t("bookings.wizard.submitError"))
        return
      }
      try {
        await bookFromCreditMut.mutateAsync({
          clientId: state.clientId,
          serviceId: state.serviceId,
          employeeId: state.employeeId,
          durationOptionId: state.durationOptionId,
          branchId: mainBranch.id,
          scheduledAt,
          deliveryType: state.deliveryType,
        })
        toast.success(t("bookings.credit.toast.success"))
        reset()
        onSuccess()
      } catch (err) {
        showApiError(err, {
          fallback: t("bookings.credit.toast.error"),
          t,
          dedupeKey: "credit-book-error",
        })
      }
      return
    }

    const payload = {
      clientId: state.clientId,
      employeeId: state.employeeId,
      serviceId: state.serviceId,
      type: "individual" as const,
      deliveryType: state.deliveryType,
      durationOptionId: state.durationOptionId ?? undefined,
      date: state.date,
      startTime: state.startTime,
      payAtClinic: state.payAtClinic,
      branchId: mainBranch?.id,
      couponCode: state.couponCode ?? undefined,
    }
    const validation = bookingPosPayloadSchema.safeParse(payload)
    if (!validation.success) {
      toast.error(t("bookings.wizard.submitError"))
      return
    }
    try {
      await createMut.mutateAsync(validation.data)
      reset()
      onSuccess()
    } catch (err) {
      showApiError(err, { fallback: t("bookings.wizard.submitError"), t })
    }
  }

  // Phase 3 — auto-detect badge appears as soon as the operator has
  // picked client + service + employee + duration. Accepting flips the
  // wizard into "book from credit" mode; dismissing is sticky for the
  // current selection.
  const creditBadgeReady =
    !!state.clientId &&
    !!state.serviceId &&
    !!state.employeeId &&
    !!state.durationOptionId

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold text-foreground">{t("bookings.newBooking")}</h1>
        <button
          type="button"
          aria-label={t("common.close")}
          className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onCancel}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {/* ── Two-column POS layout ── */}
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Form column */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* 1. Client */}
          <CollapsibleSection
            id="client"
            label={t("bookings.pos.section.client")}
            summary={summaries.client}
            isOpen={openSection === "client"}
            isFilled={summaries.client !== null}
            onToggle={() => setOpenSection("client")}
          >
            <ClientStep onSelect={handleClientSelect} />
          </CollapsibleSection>

          {/* Client's package credits — rendered OUTSIDE the collapsible client
              section so it stays visible after the client step collapses (the
              wizard auto-advances openSection to "department" on selection).
              Renders nothing when the client has no usable credits. */}
          {state.clientId && (
            <ClientCreditsPanel clientId={state.clientId} onUseCredit={handleUseCredit} />
          )}

          {/* 2. Department */}
          <CollapsibleSection
            id="department"
            label={t("bookings.pos.section.department")}
            summary={summaries.department}
            isOpen={openSection === "department"}
            isFilled={summaries.department !== null}
            onToggle={() => setOpenSection("department")}
          >
            <StepDepartment onSelect={handleDepartmentSelect} />
          </CollapsibleSection>

          {/* 3. Category (clinic) */}
          <CollapsibleSection
            id="category"
            label={t("bookings.pos.section.category")}
            summary={summaries.category}
            isOpen={openSection === "category"}
            isFilled={summaries.category !== null}
            onToggle={() => setOpenSection("category")}
          >
            {state.departmentId ? (
              <StepCategory departmentId={state.departmentId} onSelect={handleCategorySelect} />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needDepartment")} />
            )}
          </CollapsibleSection>

          {/* 4. Service — hidden when auto-selected from a single-service category */}
          {!isServiceAutoSelected && (
            <CollapsibleSection
              id="service"
              label={t("bookings.pos.section.service")}
              summary={summaries.service}
              isOpen={openSection === "service"}
              isFilled={summaries.service !== null}
              onToggle={() => setOpenSection("service")}
            >
              {state.categoryId ? (
                <StepService categoryId={state.categoryId} onSelect={handleServiceSelect} />
              ) : (
                <PosSectionHint hint={t("bookings.pos.hint.needCategory")} />
              )}
            </CollapsibleSection>
          )}

          {/* Employee */}
          <CollapsibleSection
            id="employee"
            label={t("bookings.pos.section.employee")}
            summary={summaries.employee}
            isOpen={openSection === "employee"}
            isFilled={summaries.employee !== null}
            onToggle={() => setOpenSection("employee")}
          >
            <StepEmployee serviceId={state.serviceId ?? ""} onSelect={handleEmployeeSelect} />
          </CollapsibleSection>

          {/* Type & Duration */}
          <CollapsibleSection
            id="typeDuration"
            label={t("bookings.pos.section.typeDuration")}
            summary={summaries.typeDuration}
            isOpen={openSection === "typeDuration"}
            isFilled={summaries.typeDuration !== null}
            onToggle={() => setOpenSection("typeDuration")}
          >
            {canShowTypeDuration ? (
              <StepTypeDuration
                employeeId={state.employeeId!}
                serviceId={state.serviceId!}
                selectedType={state.deliveryType}
                onSelectType={handleSelectDeliveryType}
                selectedDurationOptionId={state.durationOptionId}
                onSelectDuration={handleSelectDuration}
              />
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needService")} />
            )}
          </CollapsibleSection>

          {/* Date & Time */}
          <CollapsibleSection
            id="datetime"
            label={t("bookings.pos.section.datetime")}
            summary={summaries.datetime}
            isOpen={openSection === "datetime"}
            isFilled={summaries.datetime !== null}
            onToggle={() => setOpenSection("datetime")}
          >
            {canShowDatetime ? (
              <>
                <StepDatetime
                  employeeId={state.employeeId!}
                  serviceId={state.serviceId!}
                  deliveryType={state.deliveryType!}
                  durationOptionId={state.durationOptionId}
                  durationMins={selectedDurationMins}
                  selectedDate={state.date}
                  selectedTime={state.startTime}
                  onSelectDate={selectDate}
                  onSelectTime={selectTime}
                  maxAdvanceDays={maxAdvanceDays}
                />
                {/* Phase 3 — auto-detect "احجز من الرصيد" badge once all
                    four params are set. Renders nothing until then. */}
                {creditBadgeReady && (
                  <div className="mt-3">
                    <MatchingCreditBadge
                      clientId={state.clientId}
                      serviceId={state.serviceId}
                      employeeId={state.employeeId}
                      durationOptionId={state.durationOptionId}
                      useCredit={useCredit}
                      dismissed={creditDismissed}
                      onAccept={() => {
                        setUseCredit(true)
                        setCreditDismissed(false)
                      }}
                      onDismiss={() => {
                        setUseCredit(false)
                        setCreditDismissed(true)
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <PosSectionHint hint={t("bookings.pos.hint.needEmployee")} />
            )}
          </CollapsibleSection>
        </div>

        {/* Summary column */}
        <div className="w-full shrink-0 md:w-80">
          <BookingSummary
            clientName={state.clientName}
            serviceName={state.serviceName}
            employeeName={state.employeeName}
            type={state.deliveryType}
            durationLabel={durationSummaryLabel}
            date={state.date}
            startTime={state.startTime}
            servicePriceHalalas={servicePriceHalalas}
            payAtClinic={state.payAtClinic}
            couponCode={state.couponCode}
            submitting={createMut.isPending}
            isComplete={isComplete}
            onTogglePayAtClinic={setPayAtClinic}
            onCouponChange={setCouponCode}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
