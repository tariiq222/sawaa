"use client"

// W2B-T8 — PACKAGES-track section chain used while the operator has
// spent a FLEXIBLE credit. Modeled on `ClinicsSections` from
// `booking-pos-track-sections.tsx` so the layout + step ordering stay
// byte-identical for the operator, but WITHOUT the
// `MatchingCreditBadge` (the credit is already chosen) and WITH the
// four predicates from `@/lib/booking-credit-filter` threaded into
// the service / employee / typeDuration steps.
//
// KNOWN LIMITATION — constraints have no DEPARTMENT or CATEGORY
// dimension, so those two steps stay unfiltered. The operator may
// pick a department/category that contains no allowed service; the
// service step's `noOptions` message then explains it. This is
// recorded here so the next reader does not think it was an
// oversight. Adding department/category constraints would change the
// constraint wire shape and the matching helper, and is out of
// scope for this task.
//
// Kept under the 300-line feature cap by mirroring `ClinicsSections`
// in shape and reusing the same `CollapsibleSection` /
// `PosSectionHint` primitives.

import { useMemo } from "react"

import { Button } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"

import { CollapsibleSection, PosSectionHint, type SectionId } from "./pos-collapsible-section"
import { StepDepartment } from "./wizard-steps/step-department"
import { StepCategory } from "./wizard-steps/step-category"
import { StepService } from "./wizard-steps/step-service"
import { StepEmployee } from "./wizard-steps/step-employee"
import { StepTypeDuration } from "./wizard-steps/step-type-duration"
import { StepDatetime } from "./wizard-steps/step-datetime"

import { creditFilterPredicates } from "@/lib/booking-credit-filter"
import type { CreditFilter } from "@/lib/booking-credit-filter"

import type {
  BookingFormState,
  CategoryBookingMode,
} from "./use-booking-form-state"

interface OpenSectionController {
  openSection: SectionId
  setOpenSection: (id: SectionId) => void
}

interface FlexibleCreditSectionsProps extends OpenSectionController {
  state: BookingFormState
  summaries: Record<SectionId, string | null>
  isServiceAutoSelected: boolean
  canShowTypeDuration: boolean
  canShowDatetime: boolean
  selectedDurationMins: number | null
  maxAdvanceDays: number
  /** PACKAGES-track FLEXIBLE credit currently restricting the wizard. */
  creditFilter: CreditFilter
  onDepartmentSelect: (id: string, name: string) => void
  onCategorySelect: (id: string, name: string, bookingMode: CategoryBookingMode | null) => Promise<void>
  onServiceSelect: (id: string, name: string) => void
  onEmployeeSelect: (id: string, name: string) => void
  onSelectDeliveryType: (deliveryType: string, durationOptionId: string | null) => void
  onSelectDuration: (durationOptionId: string) => void
  onSelectDate: (date: string) => void
  onSelectTime: (startTime: string) => void
  /** Invoked when the operator clicks "إلغاء التقييد" on the chip. */
  onClearFilter: () => void
}

export function FlexibleCreditSections(
  p: FlexibleCreditSectionsProps,
): JSX.Element {
  const { t } = useLocale()
  const {
    state, openSection, setOpenSection, summaries,
    isServiceAutoSelected, canShowTypeDuration, canShowDatetime,
    selectedDurationMins, maxAdvanceDays, creditFilter,
    onDepartmentSelect, onCategorySelect, onServiceSelect,
    onEmployeeSelect, onSelectDeliveryType, onSelectDuration,
    onSelectDate, onSelectTime, onClearFilter,
  } = p

  // Build the four predicates ONCE per render — bound to the current
  // filter — so JSX never constructs fresh closures inside the row
  // maps. When the filter is null (defensive — this component is only
  // rendered when it is non-null) we skip the wire-down entirely.
  const predicates = useMemo(
    () => creditFilterPredicates(creditFilter),
    [creditFilter],
  )

  // Resolved copy for the restriction chip. `replace("{package}", …)`
  // matches the existing convention used by
  // `bookings.pos.package.remaining` in the picker.
  const chipLabel = t("bookings.pos.package.filter.active")
    .replace("{package}", creditFilter.packageName)

  return (
    <>
      {/* Restriction chip — sits ABOVE the section chain so the
          operator sees, at every step, that the wizard is narrowed
          by the package they spent. The clear button resets the
          filter and bounces the operator back to the package step
          (handled by the shell's handler). */}
      <div
        data-testid="credit-filter-chip"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
      >
        <span className="text-sm font-medium text-foreground">
          {chipLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearFilter}
          className="self-start"
        >
          {t("bookings.pos.package.filter.clear")}
        </Button>
      </div>

      <CollapsibleSection
        id="department"
        label={t("bookings.pos.section.department")}
        summary={summaries.department}
        isOpen={openSection === "department"}
        isFilled={summaries.department !== null}
        onToggle={() => setOpenSection("department")}
      >
        <StepDepartment onSelect={onDepartmentSelect} />
      </CollapsibleSection>

      <CollapsibleSection
        id="category"
        label={t("bookings.pos.section.category")}
        summary={summaries.category}
        isOpen={openSection === "category"}
        isFilled={summaries.category !== null}
        onToggle={() => setOpenSection("category")}
      >
        {state.departmentId ? (
          <StepCategory
            departmentId={state.departmentId}
            onSelect={onCategorySelect}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needDepartment")} />
        )}
      </CollapsibleSection>

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
            <StepService
              categoryId={state.categoryId}
              onSelect={onServiceSelect}
              isServiceAllowed={predicates?.isServiceAllowed}
            />
          ) : (
            <PosSectionHint hint={t("bookings.pos.hint.needCategory")} />
          )}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        id="employee"
        label={t("bookings.pos.section.employee")}
        summary={summaries.employee}
        isOpen={openSection === "employee"}
        isFilled={summaries.employee !== null}
        onToggle={() => setOpenSection("employee")}
      >
        <StepEmployee
          serviceId={state.serviceId ?? ""}
          onSelect={onEmployeeSelect}
          isEmployeeAllowed={predicates?.isEmployeeAllowed}
        />
      </CollapsibleSection>

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
            employeeId={state.employeeId ?? ""}
            serviceId={state.serviceId ?? ""}
            selectedType={state.deliveryType}
            onSelectType={onSelectDeliveryType}
            selectedDurationOptionId={state.durationOptionId}
            onSelectDuration={onSelectDuration}
            isDeliveryTypeAllowed={predicates?.isDeliveryTypeAllowed}
            isDurationAllowed={predicates?.isDurationAllowed}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needService")} />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="datetime"
        label={t("bookings.pos.section.datetime")}
        summary={summaries.datetime}
        isOpen={openSection === "datetime"}
        isFilled={summaries.datetime !== null}
        onToggle={() => setOpenSection("datetime")}
      >
        {canShowDatetime ? (
          <StepDatetime
            employeeId={state.employeeId ?? ""}
            serviceId={state.serviceId ?? ""}
            deliveryType={state.deliveryType ?? "IN_PERSON"}
            durationOptionId={state.durationOptionId}
            durationMins={selectedDurationMins}
            selectedDate={state.date}
            selectedTime={state.startTime}
            onSelectDate={onSelectDate}
            onSelectTime={onSelectTime}
            maxAdvanceDays={maxAdvanceDays}
          />
        ) : (
          <PosSectionHint hint={t("bookings.pos.hint.needEmployee")} />
        )}
      </CollapsibleSection>
    </>
  )
}
