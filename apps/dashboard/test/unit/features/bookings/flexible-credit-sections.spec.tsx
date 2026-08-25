/**
 * flexible-credit-sections.spec.tsx — W2B-T8 + W3-T11
 *
 * Boundary tests for the FLEXIBLE-credit section group
 * (`FlexibleCreditSections`). Drives the component directly so the
 * assertion reads the rendered DOM rather than reaching into shell
 * internals.
 *
 *   (f) active-filter chip/clear — chip renders the package name from
 *       `filter.active`; the clear button fires `onClearFilter`
 *       exactly once.
 *   (j) all-durations-disallowed creditFilter → `canShowDatetime` is
 *       false at the shell level; the datetime step renders its
 *       `needEmployee` hint rather than the date picker.
 *   (k) at-least-one-allowed creditFilter → datetime step opens
 *       normally once type + duration are chosen.
 *
 * The BookingPos-shell DIRECT-category guard (cases (g)–(i)) lives in
 * `flexible-credit-direct-category.spec.tsx`.
 */

import React from "react"
import { screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { FlexibleCreditSections } from "@/components/features/bookings/booking-pos-flexible-sections"
import { buildCreditFilter } from "@/lib/booking-credit-filter"
import type { SectionId } from "@/components/features/bookings/pos-collapsible-section"
import type { BookingFormState } from "@/components/features/bookings/use-booking-form-state"

import { renderWithQueryClient } from "./flexible-credit-test-helpers"

/* ─── Locale stub ───────────────────────────────────────────────────────── */

const tMap: Record<string, { ar: string; en: string }> = {
  "bookings.pos.package.filter.active": {
    ar: "مُقيَّد بباقة: {package}",
    en: "Restricted to package: {package}",
  },
  "bookings.pos.package.filter.clear": {
    ar: "إلغاء التقييد",
    en: "Clear restriction",
  },
  "bookings.pos.package.filter.noOptions": {
    ar: "لا توجد خيارات متاحة ضمن هذه الباقة",
    en: "No options available within this package",
  },
  "bookings.pos.section.department": { ar: "القسم", en: "Department" },
  "bookings.pos.section.category": { ar: "الفئة", en: "Category" },
  "bookings.pos.section.service": { ar: "الخدمة", en: "Service" },
  "bookings.pos.section.employee": { ar: "الممارس", en: "Practitioner" },
  "bookings.pos.section.typeDuration": {
    ar: "النوع والمدة",
    en: "Type & Duration",
  },
  "bookings.pos.section.datetime": { ar: "الموعد", en: "Date & Time" },
  "bookings.pos.hint.needDepartment": {
    ar: "اختر القسم أولاً",
    en: "Select a department first",
  },
  "bookings.pos.hint.needCategory": {
    ar: "اختر الفئة أولاً",
    en: "Select a category first",
  },
  "bookings.pos.hint.needService": {
    ar: "اختر الخدمة أولاً",
    en: "Select a service first",
  },
  "bookings.pos.hint.needEmployee": {
    ar: "اختر الممارس أولاً",
    en: "Select a practitioner first",
  },
}
let currentLocale: "ar" | "en" = "ar"
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: currentLocale,
    dir: currentLocale === "ar" ? ("rtl" as const) : ("ltr" as const),
    t: (k: string) =>
      tMap[k]?.[currentLocale] ?? k.replace("{package}", "<pkg>"),
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))
// Accessible stub — render a labelled <span role="img"> instead of
// <img> to satisfy `@next/next/no-img-element` while keeping the
// alt text queryable in any DOM assertion.
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string; src: string }) => (
    <span role="img" aria-label={alt} data-testid="mock-next-image" />
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  currentLocale = "ar"
})

/* ─── Shared fixtures + render helper ───────────────────────────────────── */

const EMPTY_SUMMARIES = {
  client: null,
  track: null,
  department: null,
  package: null,
  program: null,
  category: null,
  service: null,
  employee: null,
  typeDuration: null,
  datetime: null,
} as const

function buildBaseState(
  overrides: Partial<BookingFormState> = {},
): BookingFormState {
  return {
    clientId: "cli-1",
    clientName: "Sara",
    track: "PACKAGES",
    departmentId: null,
    departmentName: null,
    categoryId: null,
    categoryName: null,
    categoryBookingMode: null,
    serviceId: null,
    serviceName: null,
    employeeId: null,
    employeeName: null,
    durationOptionId: null,
    deliveryType: null,
    type: null,
    date: null,
    startTime: null,
    programId: null,
    programName: null,
    packagePurchaseId: "pkg-1",
    creditFilter: null,
    payAtClinic: true,
    collectionMethod: "CASH",
    couponCode: null,
    ...overrides,
  }
}

type RenderOpts = {
  filter: ReturnType<typeof buildCreditFilter>
  stateOverrides?: Partial<BookingFormState>
  openSection: SectionId
  isServiceAutoSelected?: boolean
  canShowTypeDuration?: boolean
  canShowDatetime: boolean
  selectedDurationMins: number | null
  onClearFilter?: () => void
}

function renderSection(opts: RenderOpts) {
  return renderWithQueryClient(
    <FlexibleCreditSections
      state={buildBaseState({
        departmentId: "dep-1",
        departmentName: "Family",
        serviceId: "svc-1",
        serviceName: "Counseling",
        employeeId: "emp-1",
        employeeName: "أحمد",
        deliveryType: "IN_PERSON",
        type: "IN_PERSON",
        creditFilter: opts.filter,
        ...opts.stateOverrides,
      })}
      openSection={opts.openSection}
      setOpenSection={vi.fn()}
      summaries={{
        ...EMPTY_SUMMARIES,
        client: "Sara",
        track: "الباقات",
        department: "Family",
        category: "استشارة طارئة",
        service: "Counseling",
        employee: "أحمد",
        typeDuration: "حضوري",
      }}
      isServiceAutoSelected={opts.isServiceAutoSelected ?? true}
      canShowTypeDuration={opts.canShowTypeDuration ?? true}
      canShowDatetime={opts.canShowDatetime}
      selectedDurationMins={opts.selectedDurationMins}
      maxAdvanceDays={90}
      creditFilter={opts.filter}
      onDepartmentSelect={vi.fn()}
      onCategorySelect={vi.fn().mockResolvedValue(undefined)}
      onServiceSelect={vi.fn()}
      onEmployeeSelect={vi.fn()}
      onSelectDeliveryType={vi.fn()}
      onSelectDuration={vi.fn()}
      onSelectDate={vi.fn()}
      onSelectTime={vi.fn()}
      onClearFilter={opts.onClearFilter ?? vi.fn()}
    />,
  )
}

/* ════════════════════════════════════════════════════════════════════════
   (f) FlexibleCreditSections — chip + clear button.
   ════════════════════════════════════════════════════════════════════════ */

describe("FlexibleCreditSections — chip + clear button", () => {
  it("(f) renders the chip with the package name interpolated into filter.active, and the clear button fires onClearFilter exactly once", async () => {
    const filter = buildCreditFilter(
      {
        id: "credit-flex-1",
        constraints: [
          { dimension: "SERVICE", mode: "INCLUDE", targetIds: ["svc-allowed"] },
        ],
        serviceId: null,
        employeeId: null,
        durationOptionId: null,
      },
      "pkg-1",
      "باقة الاستشارات",
    )

    const onClearFilter = vi.fn()

    renderSection({
      filter,
      openSection: "department" satisfies SectionId,
      isServiceAutoSelected: false,
      canShowTypeDuration: false,
      canShowDatetime: false,
      selectedDurationMins: null,
      onClearFilter,
      stateOverrides: { creditFilter: filter },
    })

    const chip = await screen.findByTestId("credit-filter-chip")
    expect(chip).toBeInTheDocument()
    expect(chip.textContent ?? "").toContain("باقة الاستشارات")
    expect(chip.textContent ?? "").toContain("مُقيَّد بباقة:")

    const clearBtn = screen.getByRole("button", { name: "إلغاء التقييد" })
    fireEvent.click(clearBtn)
    expect(onClearFilter).toHaveBeenCalledTimes(1)
  })
})

/* ════════════════════════════════════════════════════════════════════════
   BUG B — `canShowDatetime` must be false when an active creditFilter
   narrows every duration option. The shell's new gate
   `state.creditFilter == null || state.durationOptionId != null` means a
   FlexibleCreditSections instance driven with `durationOptionId` null +
   `creditFilter` non-null will receive `canShowDatetime=false`; one
   driven with `durationOptionId` set receives the date picker.
   ════════════════════════════════════════════════════════════════════════ */

describe("FlexibleCreditSections — canShowDatetime gating (BUG B)", () => {
  it("(j) all-durations-disallowed creditFilter → datetime step renders the needEmployee hint rather than the date picker; no date can be picked", async () => {
    const filter = buildCreditFilter(
      {
        id: "credit-flex-durations",
        constraints: [
          { dimension: "DURATION", mode: "INCLUDE", targetIds: ["dur-other"] },
        ],
        serviceId: null,
        employeeId: null,
        durationOptionId: null,
      },
      "pkg-1",
      "باقة الاستشارات",
    )

    renderSection({
      filter,
      openSection: "datetime" satisfies SectionId,
      canShowDatetime: false,
      // ← the new gate: every duration is forbidden so
      // resolveDurationOptionId returns null.
      stateOverrides: { durationOptionId: null },
      selectedDurationMins: null,
    })

    await waitFor(() => {
      expect(screen.getByText("اختر الممارس أولاً")).toBeInTheDocument()
    })
    expect(screen.queryByLabelText(/date|time|اليوم/i)).not.toBeInTheDocument()
  })

  it("(k) at-least-one-duration-allowed creditFilter → datetime step opens normally once type + duration are chosen", async () => {
    const filter = buildCreditFilter(
      {
        id: "credit-flex-durations-ok",
        constraints: [
          {
            dimension: "DURATION",
            mode: "INCLUDE",
            targetIds: ["dur-30", "dur-60"],
          },
        ],
        serviceId: null,
        employeeId: null,
        durationOptionId: null,
      },
      "pkg-1",
      "باقة الاستشارات",
    )

    renderSection({
      filter,
      openSection: "datetime" satisfies SectionId,
      canShowDatetime: true,
      // ← the new gate passes.
      stateOverrides: { durationOptionId: "dur-30" },
      selectedDurationMins: 30,
    })

    await waitFor(() => {
      expect(screen.getByTestId("credit-filter-chip")).toBeInTheDocument()
    })
    expect(screen.queryByText("اختر الممارس أولاً")).not.toBeInTheDocument()
  })
})