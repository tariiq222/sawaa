/**
 * flexible-credit-direct-category.spec.tsx — W3-T11
 *
 * Shell-level tests for the DIRECT-category guard (BUG A). Drives the
 * real `BookingPos` shell with mocked state, hooks, and `sonner.toast`
 * so the assertion can observe the actual user-visible side-effects
 * (toast.error fired, wizard stays on category step / advances to
 * employee step).
 *
 *   (g) active creditFilter + DIRECT hidden service DISALLOWED →
 *       no auto-select, toast.error fires with
 *       `bookings.pos.package.filter.noOptions`, wizard stays on the
 *       category step.
 *   (h) active creditFilter + DIRECT hidden service ALLOWED →
 *       auto-selects and advances to the employee step exactly as
 *       before the guard landed.
 *   (i) NO creditFilter + DIRECT category → unrestricted regression
 *       guard: auto-select + advance happens, no toast.
 *
 * The step-level predicate tests (a)–(e) live in
 * `flexible-credit-step-filters.spec.tsx`. The `FlexibleCreditSections`
 * boundary tests (chip + clear + datetime-step gate) live in
 * `flexible-credit-sections.spec.tsx`.
 */

import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClientProvider } from "@tanstack/react-query"

import { BookingPos } from "@/components/features/bookings/booking-pos"
import { useBookingFormState } from "@/components/features/bookings/use-booking-form-state"
import type { BookingFormState } from "@/components/features/bookings/use-booking-form-state"
import { buildCreditFilter } from "@/lib/booking-credit-filter"

import { META, SERVICE, makeQueryClient } from "./flexible-credit-test-helpers"

/* ─── Locale stub — only keys BookingPos consults during this path ─────── */

const tMap: Record<string, { ar: string; en: string }> = {
  "bookings.newBooking": { ar: "حجز جديد", en: "New Booking" },
  "bookings.pos.section.client": { ar: "العميل", en: "Client" },
  "bookings.pos.section.department": { ar: "القسم", en: "Department" },
  "bookings.pos.section.category": { ar: "الفئة", en: "Category" },
  "bookings.pos.section.employee": { ar: "الممارس", en: "Practitioner" },
  "bookings.pos.section.typeDuration": { ar: "النوع والمدة", en: "Type & Duration" },
  "bookings.pos.section.datetime": { ar: "الموعد", en: "Date & Time" },
  "bookings.pos.section.service": { ar: "الخدمة", en: "Service" },
  "bookings.pos.track.CLINICS": { ar: "العيادات", en: "Clinics" },
  "bookings.pos.track.PACKAGES": { ar: "الباقات", en: "Packages" },
  "bookings.pos.track.GROUP": { ar: "المجموعات", en: "Group" },
  "bookings.pos.hint.needDepartment": { ar: "اختر القسم أولاً", en: "Select a department first" },
  "bookings.pos.hint.needCategory": { ar: "اختر الفئة أولاً", en: "Select a category first" },
  "bookings.pos.hint.needService": { ar: "اختر الخدمة أولاً", en: "Select a service first" },
  "bookings.pos.hint.needEmployee": { ar: "اختر الممارس أولاً", en: "Select a practitioner first" },
  "bookings.pos.package.filter.noOptions": {
    ar: "لا توجد خيارات متاحة ضمن هذه الباقة",
    en: "No options available within this package",
  },
  "common.close": { ar: "إغلاق", en: "Close" },
}
let currentLocale: "ar" | "en" = "ar"
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: currentLocale,
    dir: currentLocale === "ar" ? ("rtl" as const) : ("ltr" as const),
    t: (k: string) => tMap[k]?.[currentLocale] ?? k,
    toggleLocale: vi.fn(),
  }),
}))

/* ─── Network stubs ─────────────────────────────────────────────────────── */

const { fetchServices, fetchServiceEmployees, fetchCategories } =
  vi.hoisted(() => ({ fetchServices: vi.fn(), fetchServiceEmployees: vi.fn(), fetchCategories: vi.fn() }))
const { fetchEmployees, fetchAvailability, fetchEmployeeServiceTypes } =
  vi.hoisted(() => ({ fetchEmployees: vi.fn(), fetchAvailability: vi.fn(), fetchEmployeeServiceTypes: vi.fn() }))

vi.mock("@/lib/api/services", () => ({ fetchServices, fetchServiceEmployees, fetchCategories }))
vi.mock("@/lib/api/employees", () => ({ fetchEmployees }))
vi.mock("@/lib/api/employees-schedule", () => ({
  fetchAvailability,
  fetchEmployeeServiceTypes,
  fetchAvailableDays: vi.fn().mockResolvedValue([]),
  fetchSlots: vi.fn().mockResolvedValue([]),
  fetchEmployeeServices: vi.fn().mockResolvedValue([]),
}))

/* ─── Toast spies ────────────────────────────────────────────────────────── */

const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: toastError, success: toastSuccess } }))

/* ─── Shell-level mocks for BookingPos ──────────────────────────────────── */

vi.mock("@/hooks/use-branches", () => ({
  useBranches: vi.fn(() => ({ branches: [{ id: "branch-1", isMain: true }] })),
}))
vi.mock("@/hooks/use-organization-settings", () => ({
  // `BookingSummary` → `useOrganizationConfig` → `useOrganizationSettings`.
  // Returning `undefined` keeps the date-format / locale defaults — this
  // suite does not assert on summary copy.
  useOrganizationSettings: vi.fn(() => ({ data: undefined })),
  useBookingSettings: vi.fn(() => ({ data: { maxAdvanceBookingDays: 90 } })),
  usePaymentSettings: vi.fn(() => ({ data: undefined })),
}))
vi.mock("@/components/features/bookings/use-booking-pos-submit", () => ({
  useBookingPosSubmit: vi.fn(() => ({ submit: vi.fn().mockResolvedValue(undefined), isSubmitting: false })),
}))

/** Build the full set of state + handlers used by `BookingPos`. The
 *  default mock supplies every callback as `vi.fn()`; per-case setup
 *  swaps in a tailored `state` and the `selectCategory` spy. */
function buildHookReturn(state: BookingFormState, selectCategory: ReturnType<typeof vi.fn>) {
  return {
    state,
    isComplete: false,
    reset: vi.fn(),
    selectClient: vi.fn(), selectTrack: vi.fn(),
    selectDepartment: vi.fn(), selectCategory,
    selectService: vi.fn(), selectEmployee: vi.fn(),
    selectDeliveryType: vi.fn(), selectType: vi.fn(),
    selectDurationOption: vi.fn(), selectDate: vi.fn(), selectTime: vi.fn(),
    selectProgram: vi.fn(),
    setPayAtClinic: vi.fn(), setCollectionMethod: vi.fn(), setCouponCode: vi.fn(),
    applyCreditTarget: vi.fn(), applyPackageCreditTarget: vi.fn(),
    applyCreditFilter: vi.fn(), clearCreditFilter: vi.fn(),
  }
}

vi.mock("@/components/features/bookings/use-booking-form-state", () => ({
  useBookingFormState: vi.fn(() => buildHookReturn({
    clientId: null, clientName: null, track: null,
    departmentId: null, departmentName: null,
    categoryId: null, categoryName: null, categoryBookingMode: null,
    serviceId: null, serviceName: null,
    employeeId: null, employeeName: null,
    durationOptionId: null, deliveryType: null, type: null,
    date: null, startTime: null,
    programId: null, programName: null,
    packagePurchaseId: null, creditFilter: null,
    payAtClinic: true, collectionMethod: "CASH", couponCode: null,
  } as BookingFormState, vi.fn()) as ReturnType<typeof useBookingFormState>),
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

/* ─── Shell-level fixtures + helpers ────────────────────────────────────── */

const DIRECT_CATEGORY = {
  id: "cat-direct-1",
  nameAr: "استشارة طارئة",
  nameEn: "Urgent Consultation",
  bookingMode: "DIRECT" as const,
  isActive: true,
  _count: { services: 0 },
  departmentId: "dep-1",
}

const HIDDEN_SERVICE = (id = "svc-hidden-1") => ({ ...SERVICE(id, "خدمة خفية"), isHidden: true })

function buildShellState(overrides: Partial<BookingFormState> = {}): BookingFormState {
  return {
    clientId: "cli-1", clientName: "Sara", track: "PACKAGES",
    departmentId: "dep-1", departmentName: "Family",
    categoryId: null, categoryName: null, categoryBookingMode: null,
    serviceId: null, serviceName: null,
    employeeId: null, employeeName: null,
    durationOptionId: null, deliveryType: null, type: null,
    date: null, startTime: null,
    programId: null, programName: null,
    packagePurchaseId: "pkg-1", creditFilter: null,
    payAtClinic: true, collectionMethod: "CASH", couponCode: null,
    ...overrides,
  }
}

const selectCategoryMock = vi.fn()

function setupShell(initial: BookingFormState) {
  vi.mocked(useBookingFormState).mockReturnValue(
    buildHookReturn(initial, selectCategoryMock) as ReturnType<typeof useBookingFormState>,
  )
}

function expandCategorySection() {
  const root = document.body.querySelector('[data-section="category"]')
  if (!root) throw new Error("Category section not rendered.")
  const btn = root.querySelector("button")
  if (!btn) throw new Error("Category section header button not found")
  fireEvent.click(btn)
}

beforeEach(() => {
  vi.clearAllMocks()
  currentLocale = "ar"
  fetchAvailability.mockResolvedValue([{ isActive: true }])
})

/* ════════════════════════════════════════════════════════════════════════
   (g) DIRECT + DISALLOWED hidden service → no auto-select, toast.
   (h) DIRECT + ALLOWED hidden service    → auto-select + advance.
   (i) NO creditFilter + DIRECT           → unrestricted regression.
   ════════════════════════════════════════════════════════════════════════ */

describe("BookingPos — DIRECT-category guard (BUG A)", () => {
  it("(g) DIRECT category + DISALLOWED hidden service → no auto-select, toast fires, wizard does not advance", async () => {
    // Restrict the FLEXIBLE credit to a DIFFERENT service id so the
    // DIRECT category's hidden service is forbidden.
    const filter = buildCreditFilter(
      {
        id: "credit-flex-1",
        constraints: [
          { dimension: "SERVICE", mode: "INCLUDE", targetIds: ["svc-allowed"] },
        ],
        serviceId: null, employeeId: null, durationOptionId: null,
      },
      "pkg-1",
      "باقة الاستشارات",
    )

    fetchCategories.mockResolvedValue({ items: [DIRECT_CATEGORY], meta: { ...META, total: 1 } })
    fetchServices.mockResolvedValue({ items: [HIDDEN_SERVICE("svc-hidden-1")], meta: { ...META, total: 1 } })

    setupShell(buildShellState({ creditFilter: filter }))

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <BookingPos onSuccess={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
    )

    // The wizard opens collapsed at the client step; expand the
    // category section so StepCategory is visible. We locate it via
    // `data-section="category"` (stable across locales) that
    // CollapsibleSection always emits, rather than by the localised
    // label, so this assertion does not depend on the mocked t-stub.
    expandCategorySection()

    // Click the DIRECT category card — fires the real handleCategorySelect.
    const categoryCard = await screen.findByRole("button", { name: /استشارة طارئة/ })
    fireEvent.click(categoryCard)

    // The guard must fire the existing `filter.noOptions` toast.
    // The mock `t()` translates the key to Arabic, so the toast
    // payload is the translated string.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("لا توجد خيارات متاحة ضمن هذه الباقة")
    })
    // No auto-select happened — selectCategory must NOT have been
    // called with an autoService arg.
    expect(selectCategoryMock).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(),
      expect.objectContaining({ serviceId: "svc-hidden-1" }),
    )
  })

  it("(h) DIRECT category + ALLOWED hidden service → auto-selects and advances exactly as today", async () => {
    const filter = buildCreditFilter(
      {
        id: "credit-flex-2",
        constraints: [
          { dimension: "SERVICE", mode: "INCLUDE", targetIds: ["svc-hidden-1"] },
        ],
        serviceId: null, employeeId: null, durationOptionId: null,
      },
      "pkg-1",
      "باقة الاستشارات",
    )

    fetchCategories.mockResolvedValue({ items: [DIRECT_CATEGORY], meta: { ...META, total: 1 } })
    fetchServices.mockResolvedValue({ items: [HIDDEN_SERVICE("svc-hidden-1")], meta: { ...META, total: 1 } })

    setupShell(buildShellState({ creditFilter: filter }))

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <BookingPos onSuccess={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
    )

    expandCategorySection()
    const categoryCard = await screen.findByRole("button", { name: /استشارة طارئة/ })
    fireEvent.click(categoryCard)

    // Happy path: selectCategory gets the autoService arg, the shell
    // advances to the employee step. The guard must stay silent — no toast.
    await waitFor(() => {
      expect(selectCategoryMock).toHaveBeenCalledWith(
        "cat-direct-1", "استشارة طارئة", "DIRECT",
        expect.objectContaining({ serviceId: "svc-hidden-1" }),
      )
    })
    expect(toastError).not.toHaveBeenCalledWith("لا توجد خيارات متاحة ضمن هذه الباقة")
  })

  it("(i) NO creditFilter + DIRECT category → unrestricted regression guard (auto-select + advance, no toast)", async () => {
    // CLINICS track renders ClinicsSections (which carries a category
    // step) rather than FlexibleCreditSections — the latter only mounts
    // under an active creditFilter. So the regression guard uses
    // CLINICS to surface the category section even with no creditFilter.
    fetchCategories.mockResolvedValue({ items: [DIRECT_CATEGORY], meta: { ...META, total: 1 } })
    fetchServices.mockResolvedValue({ items: [HIDDEN_SERVICE("svc-hidden-1")], meta: { ...META, total: 1 } })

    setupShell(buildShellState({
      creditFilter: null,
      track: "CLINICS",
      packagePurchaseId: null,
    }))

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <BookingPos onSuccess={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
    )

    expandCategorySection()
    const categoryCard = await screen.findByRole("button", { name: /استشارة طارئة/ })
    fireEvent.click(categoryCard)

    // Unrestricted DIRECT path is byte-identical to today: the guard
    // is a no-op when `state.creditFilter == null`.
    await waitFor(() => {
      expect(selectCategoryMock).toHaveBeenCalledWith(
        "cat-direct-1", "استشارة طارئة", "DIRECT",
        expect.objectContaining({ serviceId: "svc-hidden-1" }),
      )
    })
    expect(toastError).not.toHaveBeenCalled()
  })
})
