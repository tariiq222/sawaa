/**
 * flexible-credit-step-filters.spec.tsx — W2B-T8
 *
 * Real-tree tests for the predicate gates that the wizard's
 * StepService / StepEmployee / StepTypeDuration components apply when
 * the operator is operating under an active FLEXIBLE package credit.
 * Mirrors the mocking style of `step-employee.spec.tsx` and
 * `step-service-filter.spec.tsx`: the network layer is stubbed, the
 * wizard steps are real so the rendered DOM is the real DOM.
 *
 *   (a) StepService + isServiceAllowed → only allowed services render.
 *   (b) StepService + rejecting predicate → `filter.noOptions` empty state.
 *   (c) StepService WITHOUT predicate    → every service renders
 *                                          (default-behaviour regression).
 *   (d) StepEmployee + isEmployeeAllowed → disallowed practitioners hidden.
 *   (e) StepTypeDuration + isDurationAllowed
 *       → disallowed durations hidden AND auto-select never seeds a
 *         forbidden id (either not called or called with an allowed id).
 *
 * The remaining FLEXIBLE-credit cases — chip / clear button, the
 * DIRECT-category shell guard, and the datetime-step gate — live in
 * `flexible-credit-sections.spec.tsx` and
 * `flexible-credit-direct-category.spec.tsx`.
 */

import React from "react"
import { screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

import { StepService } from "@/components/features/bookings/wizard-steps/step-service"
import { StepEmployee } from "@/components/features/bookings/wizard-steps/step-employee"
import { StepTypeDuration } from "@/components/features/bookings/wizard-steps/step-type-duration"

import {
  META,
  SERVICE,
  SERVICE_EMPLOYEE,
  renderWithQueryClient,
} from "./flexible-credit-test-helpers"

/* ─── Locale stub ───────────────────────────────────────────────────────── */

const tMap: Record<string, { ar: string; en: string }> = {
  "bookings.wizard.step.service.search": {
    ar: "ابحث عن خدمة",
    en: "Search for a service",
  },
  "bookings.wizard.step.typeDuration.typeTitle": {
    ar: "النوع",
    en: "Type",
  },
  "bookings.wizard.step.typeDuration.durationTitle": {
    ar: "المدة",
    en: "Duration",
  },
  "bookings.wizard.step.typeDuration.noTypes": {
    ar: "لا توجد أنواع متاحة",
    en: "No types available",
  },
  "bookings.wizard.step.typeDuration.inPerson": {
    ar: "حضوري",
    en: "In Person",
  },
  "bookings.wizard.step.typeDuration.online": {
    ar: "عن بعد",
    en: "Online",
  },
  "bookings.wizard.step.typeDuration.minutes": {
    ar: "دقيقة",
    en: "min",
  },
  "bookings.wizard.step.service.currency": { ar: "ر.س", en: "SAR" },
  "bookings.pos.package.filter.noOptions": {
    ar: "لا توجد خيارات متاحة ضمن هذه الباقة",
    en: "No options available within this package",
  },
  "bookings.pos.disabled.service": { ar: "لا يوجد مختص", en: "No practitioner" },
  "bookings.pos.disabled.employee": { ar: "لا يوجد وقت متاح", en: "No time available" },
  "bookings.wizard.noEmployees": {
    ar: "لا يوجد ممارسون متاحون",
    en: "No practitioners available",
  },
  "bookings.wizard.step.employee.availableToday": {
    ar: "متاح اليوم",
    en: "Available today",
  },
  "bookings.wizard.step.employee.nextAvailable": {
    ar: "أقرب موعد",
    en: "Next available",
  },
  "bookings.client.search.noResults": {
    ar: "لا توجد نتائج",
    en: "No results",
  },
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

const { fetchServices } = vi.hoisted(() => ({ fetchServices: vi.fn() }))
const {
  fetchServiceEmployees,
  fetchEmployees,
  fetchAvailability,
  fetchEmployeeServiceTypes,
} = vi.hoisted(() => ({
  fetchServiceEmployees: vi.fn(),
  fetchEmployees: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
}))

vi.mock("@/lib/api/services", () => ({
  fetchServices,
  fetchServiceEmployees,
}))
vi.mock("@/lib/api/employees", () => ({ fetchEmployees }))
vi.mock("@/lib/api/employees-schedule", () => ({
  fetchAvailability,
  fetchEmployeeServiceTypes,
  fetchAvailableDays: vi.fn().mockResolvedValue([]),
  fetchSlots: vi.fn().mockResolvedValue([]),
  fetchEmployeeServices: vi.fn().mockResolvedValue([]),
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
  fetchAvailability.mockResolvedValue([{ isActive: true }])
})

/* ════════════════════════════════════════════════════════════════════════
   (a) StepService + isServiceAllowed → only allowed services render.
   ════════════════════════════════════════════════════════════════════════ */

describe("StepService — isServiceAllowed predicate", () => {
  it("(a) renders ONLY the allowed services; disallowed ones are absent from the DOM", async () => {
    fetchServices.mockResolvedValue({
      items: [
        SERVICE("svc-1", "استشارة زوجية"),
        SERVICE("svc-2", "استشارة أسرية"),
        SERVICE("svc-3", "جلسة فردية"),
      ],
      meta: { ...META, total: 3 },
    })

    renderWithQueryClient(
      <StepService
        categoryId="cat-1"
        onSelect={vi.fn()}
        isServiceAllowed={(id) => id === "svc-1" || id === "svc-3"}
      />,
    )

    expect(await screen.findByText("استشارة زوجية")).toBeInTheDocument()
    expect(screen.getByText("جلسة فردية")).toBeInTheDocument()
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()
  })

  it("(b) with a predicate that rejects everything, renders the filter.noOptions message", async () => {
    fetchServices.mockResolvedValue({
      items: [
        SERVICE("svc-1", "استشارة زوجية"),
        SERVICE("svc-2", "استشارة أسرية"),
      ],
      meta: { ...META, total: 2 },
    })

    renderWithQueryClient(
      <StepService
        categoryId="cat-1"
        onSelect={vi.fn()}
        isServiceAllowed={() => false}
      />,
    )

    const empty = await screen.findByTestId("step-service-empty")
    expect(empty.textContent ?? "").toContain("لا توجد خيارات متاحة")
    expect(screen.queryByText("استشارة زوجية")).not.toBeInTheDocument()
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()
  })

  it("(c) with NO predicate, every service renders (default-behaviour regression)", async () => {
    fetchServices.mockResolvedValue({
      items: [
        SERVICE("svc-1", "استشارة زوجية"),
        SERVICE("svc-2", "استشارة أسرية"),
        SERVICE("svc-3", "جلسة فردية"),
      ],
      meta: { ...META, total: 3 },
    })

    renderWithQueryClient(
      <StepService categoryId="cat-1" onSelect={vi.fn()} />,
    )

    expect(await screen.findByText("استشارة زوجية")).toBeInTheDocument()
    expect(screen.getByText("استشارة أسرية")).toBeInTheDocument()
    expect(screen.getByText("جلسة فردية")).toBeInTheDocument()
    expect(screen.queryByTestId("step-service-empty")).not.toBeInTheDocument()
  })
})

/* ════════════════════════════════════════════════════════════════════════
   (d) StepEmployee + isEmployeeAllowed hides disallowed practitioners.
   ════════════════════════════════════════════════════════════════════════ */

describe("StepEmployee — isEmployeeAllowed predicate", () => {
  it("(d) hides practitioners whose id fails the predicate", async () => {
    fetchServiceEmployees.mockResolvedValue([
      SERVICE_EMPLOYEE("emp-1", "أحمد"),
      SERVICE_EMPLOYEE("emp-2", "ليلى"),
      SERVICE_EMPLOYEE("emp-3", "نورة"),
    ])

    renderWithQueryClient(
      <StepEmployee
        serviceId="svc-1"
        onSelect={vi.fn()}
        isEmployeeAllowed={(id) => id === "emp-1" || id === "emp-3"}
      />,
    )

    expect(await screen.findByText("أحمد")).toBeInTheDocument()
    expect(screen.getByText("نورة")).toBeInTheDocument()
    expect(screen.queryByText("ليلى")).not.toBeInTheDocument()
  })
})

/* ════════════════════════════════════════════════════════════════════════
   (e) StepTypeDuration — predicate hides disallowed durations AND the
       auto-select callback never receives a disallowed id.
   ════════════════════════════════════════════════════════════════════════ */

const svcTypeWithDurations = (
  deliveryType: "IN_PERSON" | "ONLINE",
  options: Array<{ id: string; label: string; isDefault?: boolean }>,
) => ({
  id: `st-${deliveryType.toLowerCase()}`,
  deliveryType,
  price: 15000,
  duration: 60,
  durationMins: 60,
  useCustomOptions: false,
  isActive: true,
  durationOptions: options.map((o, i) => ({
    id: o.id,
    employeeServiceTypeId: `st-${deliveryType.toLowerCase()}`,
    label: o.label,
    labelAr: o.label,
    durationMinutes: 30 + i * 30,
    price: 10000 + i * 2000,
    isDefault: o.isDefault ?? false,
    sortOrder: i,
  })),
})

describe("StepTypeDuration — isDurationAllowed predicate", () => {
  it("(e) hides disallowed duration options AND the auto-select callback never seeds a forbidden id", async () => {
    fetchEmployeeServiceTypes.mockResolvedValue([
      svcTypeWithDurations("IN_PERSON", [
        { id: "dur-30", label: "30" },
        { id: "dur-60", label: "60", isDefault: true },
        { id: "dur-90", label: "90" },
      ]),
    ])

    const onSelectType = vi.fn()
    const isDurationAllowed = (id: string) => id === "dur-60"

    renderWithQueryClient(
      <StepTypeDuration
        employeeId="emp-1"
        serviceId="svc-1"
        selectedType={null}
        onSelectType={onSelectType}
        selectedDurationOptionId={null}
        onSelectDuration={vi.fn()}
        isDurationAllowed={isDurationAllowed}
      />,
    )

    // Picker renders — wait for it to mount.
    await waitFor(() => {
      expect(onSelectType).toHaveBeenCalled()
    })

    const calls = onSelectType.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    calls.forEach(([, durationOptionId]) => {
      if (durationOptionId === null) return
      expect(isDurationAllowed(durationOptionId)).toBe(true)
    })

    // Disallowed ids must be absent from the rendered DOM.
    expect(screen.queryByText("30")).not.toBeInTheDocument()
    expect(screen.queryByText("90")).not.toBeInTheDocument()
  })
})