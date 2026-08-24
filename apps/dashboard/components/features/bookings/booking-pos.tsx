"use client"

// EXCEPTION: feature-component size limit (300) and absolute file size
// limit (350) exceeded — 2026-08-23 — Phase 6 of session-packages
// rebuild added the three-track booking wizard (CLINICS / GROUP /
// PACKAGES). The per-track section groups were extracted into
// `booking-pos-track-sections.tsx`, the form column into
// `booking-pos-form-column.tsx`, and `handleSubmit` into
// `useBookingPosSubmit` so the shell stays under the absolute limit.
// The shell still owns state, mutation wiring, and the BookingSummary.
//
// W2-T2 update — 2026-08-23 — also wires `usePaymentSettings` to gate
// the "الدفع في العيادة" option, exposes the `hideCollectionTiming`
// flag on the credit/package path, and forwards `collectionMethod` +
// `setCollectionMethod` into `BookingSummary`. This added a handful
// of lines to the shell (still above the 350-line absolute limit).

import { useState, useMemo, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useLocale } from "@/components/locale-provider"
import { useBranches } from "@/hooks/use-branches"
import { useBookingSettings, usePaymentSettings } from "@/hooks/use-organization-settings"
import { queryKeys } from "@/lib/query-keys"
import { fetchServices } from "@/lib/api/services"
import { fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"
import type { EmployeeServiceType } from "@/lib/types/employee"

import { BookingSummary } from "./booking-summary"
import { BookingPosFormColumn } from "./booking-pos-form-column"
import type { SectionId } from "./pos-collapsible-section"
import type { BookingTrack, CreditTarget } from "./use-booking-form-state"
import { useBookingFormState } from "./use-booking-form-state"
import { useBookingPosSubmit } from "./use-booking-pos-submit"

/* ─── Pure helpers ─── */

/**
 * When the operator switches delivery type, preserve an already-set
 * durationOptionId if it still exists among the new serviceType's options.
 * Falls back to `defaultId` (the type's default/first option) otherwise.
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
  // /dashboard/bookings/from-credit instead of /dashboard/bookings.
  const [useCredit, setUseCredit] = useState(false)
  const [creditDismissed, setCreditDismissed] = useState(false)

  const { branches } = useBranches()
  const mainBranch = branches.find((b) => b.isMain) ?? branches[0]
  const { data: bookingSettings } = useBookingSettings()
  const maxAdvanceDays = bookingSettings?.maxAdvanceBookingDays ?? 90
  // W2-T2 — read payment settings so the "Pay at Clinic" option can be
  // disabled (and `payAtClinic` forced to false) when the org has
  // turned this payment mode off. While settings are still loading
  // (`undefined`) we MUST preserve today's behavior — do not force,
  // do not disable — so a slow network cannot silently turn a
  // reception default into a paid booking.
  const { data: paymentSettings } = usePaymentSettings()
  const queryClient = useQueryClient()

  const {
    state, isComplete, reset, selectClient, selectTrack, selectDepartment,
    selectCategory, selectService, selectEmployee, selectDeliveryType,
    selectDurationOption, selectDate, selectTime, selectProgram,
    setPayAtClinic, setCollectionMethod, setCouponCode,
    applyCreditTarget, applyPackageCreditTarget,
  } = useBookingFormState()

  const { submit: handleSubmit, isSubmitting } = useBookingPosSubmit({
    state, mainBranch, useCredit, reset, onSuccess,
  })

  const handleUseCredit = (target: CreditTarget) => {
    applyCreditTarget(target)
    setOpenSection("typeDuration")
  }

  // Phase 6 — selecting a track resets every downstream pick and re-arms
  // the credit badge so a fresh suggestion can appear.
  const handleTrackSelect = (track: BookingTrack) => {
    selectTrack(track)
    setOpenSection(
      track === "CLINICS" ? "department" : track === "PACKAGES" ? "package" : "program",
    )
    setUseCredit(false)
    setCreditDismissed(false)
  }

  // Phase 6 — PACKAGES track: jump-fill the credit triple AND record
  // which purchase it came from so submit hits /from-credit.
  const handlePackageCreditSelected = (
    target: CreditTarget,
    packagePurchaseId: string,
  ) => {
    applyPackageCreditTarget(target, packagePurchaseId)
    setUseCredit(true)
    setOpenSection("typeDuration")
  }

  // Phase 6 — GROUP track: StepProgram already fired the enrollment
  // mutation; close the wizard so handleSubmit can never create a
  // second booking.
  const handleProgramEnrolled = (programId: string, programName: string) => {
    selectProgram(programId, programName)
    reset()
    onSuccess()
  }

  // Phase 3 — re-arm the credit badge whenever the operator changes
  // any of the four matching-credit params.
  const handleClientSelect = (id: string, name: string) => {
    selectClient(id, name)
    // Open the right section based on the currently-selected track.
    // On a fresh booking track is null → land on the track step so the
    // operator immediately sees the three booking-path cards.
    setOpenSection(
      state.track === "PACKAGES"
        ? "package"
        : state.track === "GROUP"
        ? "program"
        : state.track === "CLINICS"
        ? "department"
        : "track",
    )
    setUseCredit(false)
    setCreditDismissed(false)
  }
  const handleDepartmentSelect = (id: string, name: string) => {
    selectDepartment(id, name)
    setOpenSection("category")
  }
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
    // valid for the chosen delivery type.
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
    const matchHasMultiple = (matchingServiceType?.durationOptions?.length ?? 0) > 1
    setOpenSection(matchHasMultiple ? "typeDuration" : "datetime")
    // PACKAGES-track sessions must NEVER charge the client twice: keep the
    // credit-mode flag on so submit hits /from-credit, not /bookings.
    // The credit badge is a CLINICS-only auto-detect affordance and can be
    // dismissed freely when we're committed to a package credit.
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }

  const handleSelectDuration = (durationOptionId: string) => {
    selectDurationOption(durationOptionId)
    setOpenSection("datetime")
    if (!state.packagePurchaseId) setUseCredit(false)
    setCreditDismissed(false)
  }

  /**
   * When a category (clinic) is selected, branch on `category.bookingMode`:
   *   - DIRECT   → hidden service auto-selected, skip to employee step.
   *   - SERVICES → user always picks a service, even for single-service
   *                categories.
   *   - null     → behave like SERVICES (legacy clinics).
   * If a DIRECT category has no hidden service in the cache (data drift),
   * fall back to the service step rather than blocking the wizard.
   */
  const handleCategorySelect = useCallback(async (
    id: string,
    name: string,
    bookingMode: "DIRECT" | "SERVICES" | null,
  ) => {
    const filters = { categoryId: id, isActive: true, limit: 100, includeHidden: true }
    const qKey = queryKeys.services.list(filters)
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
    }
    selectCategory(id, name, bookingMode)
    setOpenSection("service")
  }, [queryClient, selectCategory, locale])

  const isServiceAutoSelected = useMemo(
    () => state.categoryBookingMode === "DIRECT" && !!state.serviceId,
    [state.categoryBookingMode, state.serviceId],
  )

  const deliveryTypeLabels: Record<string, string> = {
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
  }
  const summaries: Record<SectionId, string | null> = {
    client: state.clientName,
    track: state.track ? t(`bookings.pos.track.${state.track.toLowerCase()}`) : null,
    department: state.departmentName,
    // PACKAGES-track summary stays null — the section name lives inside
    // StepPackage; form state only carries `packagePurchaseId`. The
    // section's own isFilled gate (serviceId+employeeId) marks it filled.
    package: null,
    program: state.programName,
    category: state.categoryName,
    service: state.serviceName,
    employee: state.employeeName,
    typeDuration: state.deliveryType ? deliveryTypeLabels[state.deliveryType] ?? null : null,
    datetime: state.date
      ? state.date + (state.startTime ? ` · ${state.startTime}` : "")
      : null,
  }

  const canShowTypeDuration = Boolean(state.serviceId && state.employeeId)
  const canShowDatetime = Boolean(state.serviceId && state.employeeId && state.deliveryType)

  // Selected service price (halalas) for the summary.
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

  const creditBadgeReady =
    !!state.clientId &&
    !!state.serviceId &&
    !!state.employeeId &&
    !!state.durationOptionId

  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
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

      <div className="flex flex-col gap-6 md:flex-row">
        <BookingPosFormColumn
          state={state}
          openSection={openSection}
          setOpenSection={setOpenSection}
          summaries={summaries}
          isServiceAutoSelected={isServiceAutoSelected}
          canShowTypeDuration={canShowTypeDuration}
          canShowDatetime={canShowDatetime}
          selectedDurationMins={selectedDurationMins}
          maxAdvanceDays={maxAdvanceDays}
          creditBadgeReady={creditBadgeReady}
          useCredit={useCredit}
          creditDismissed={creditDismissed}
          branchId={mainBranch?.id ?? null}
          clientLabel={t("bookings.pos.section.client")}
          onClientSelect={handleClientSelect}
          onTrackSelect={handleTrackSelect}
          onUseCredit={handleUseCredit}
          onPackageCreditSelected={handlePackageCreditSelected}
          onProgramEnrolled={handleProgramEnrolled}
          onDepartmentSelect={handleDepartmentSelect}
          onCategorySelect={handleCategorySelect}
          onServiceSelect={handleServiceSelect}
          onEmployeeSelect={handleEmployeeSelect}
          onSelectDeliveryType={handleSelectDeliveryType}
          onSelectDuration={handleSelectDuration}
          onSelectDate={selectDate}
          onSelectTime={selectTime}
          onAcceptCredit={() => { setUseCredit(true); setCreditDismissed(false) }}
          onDismissCredit={() => { setUseCredit(false); setCreditDismissed(true) }}
        />

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
            collectionMethod={state.collectionMethod}
            // W2-T2 — PACKAGES track and explicit package-credit
            // selection both post to /from-credit. Those bookings are
            // zero-priced and pre-paid, so any collection UI would be
            // misleading; hide the timing group + method picker.
            hideCollectionTiming={
              useCredit ||
              state.track === "PACKAGES" ||
              !!state.packagePurchaseId
            }
            paymentSettings={paymentSettings}
            couponCode={state.couponCode}
            submitting={isSubmitting}
            isComplete={isComplete}
            onTogglePayAtClinic={setPayAtClinic}
            onChangeCollectionMethod={setCollectionMethod}
            onCouponChange={setCouponCode}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}