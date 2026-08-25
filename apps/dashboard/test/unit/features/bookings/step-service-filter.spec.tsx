/**
 * step-service-filter.spec.tsx — W3-T10
 *
 * Real-tree tests for the StepService two-stage narrowing (predicate
 * outer, search inner) and its two distinct empty states. Mirrors the
 * mocking style of `flexible-credit-flow.spec.tsx`.
 *
 * Coverage:
 *   a. Predicate + some allowed → only the allowed services render.
 *   b. Predicate + some allowed + search matches NOTHING → search
 *      input STILL mounted, step-service-no-results shown,
 *      step-service-empty NOT shown. (The bug regression.)
 *   c. Predicate rejects everything → step-service-empty with
 *      `filter.noOptions`, search input omitted.
 *   d. Search cannot bypass the predicate — typing a disallowed
 *      service's name never surfaces it.
 *   e. NO predicate + missed search → today's unrestricted behaviour
 *      reproduced exactly (search input mounted, no extra empty state).
 */

import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { StepService } from "@/components/features/bookings/wizard-steps/step-service"

/* ─── Locale stub ───────────────────────────────────────────────────────── */

const tMap: Record<string, { ar: string; en: string }> = {
  "bookings.wizard.step.service.search": { ar: "ابحث عن خدمة...", en: "Search services..." },
  "bookings.wizard.step.service.currency": { ar: "ر.س", en: "SAR" },
  "bookings.wizard.step.typeDuration.minutes": { ar: "دقيقة", en: "min" },
  "bookings.pos.disabled.service": { ar: "لا يوجد مختص", en: "No practitioner" },
  "bookings.pos.package.filter.noOptions": {
    ar: "لا توجد خيارات متاحة ضمن هذه الباقة",
    en: "No options available within this package",
  },
  "bookings.client.search.noResults": { ar: "لا توجد نتائج —", en: "No results —" },
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
vi.mock("@/lib/api/services", () => ({ fetchServices }))
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))

/* ─── Test wrappers ─────────────────────────────────────────────────────── */

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
}
function renderWithQueryClient(node: React.ReactNode) {
  return render(<QueryClientProvider client={makeQueryClient()}>{node}</QueryClientProvider>)
}

const META = { total: 0, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPreviousPage: false }
const SERVICE = (
  id: string,
  nameAr: string,
  nameEn: string | null = null,
  employeeCount = 1
) => ({
  id,
  ref: Number(id.replace(/\D/g, "")) || 1,
  nameAr, nameEn,
  descriptionAr: null, descriptionEn: null,
  categoryId: "cat-1",
  price: 15000,
  currency: "SAR",
  durationMins: 60,
  isActive: true, isHidden: false,
  hidePriceOnBooking: false, hideDurationOnBooking: false,
  iconName: null, iconBgColor: null, imageUrl: null,
  bufferMinutes: 0, minLeadMinutes: null, maxAdvanceDays: null,
  depositEnabled: false, depositAmount: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  employeeCount,
})
function mockServices(items: Array<ReturnType<typeof SERVICE>>) {
  fetchServices.mockResolvedValue({ items, meta: { ...META, total: items.length } })
}

beforeEach(() => {
  vi.clearAllMocks()
  currentLocale = "ar"
})

const SEARCH_PLACEHOLDER = "ابحث عن خدمة..."
const PKG_NO_OPTIONS = "لا توجد خيارات متاحة ضمن هذه الباقة"
const NO_RESULTS = "لا توجد نتائج"

/* (a) Predicate narrows the visible grid. */

describe("StepService — predicate narrows the visible grid", () => {
  it("(a) with a predicate that allows a subset, only the allowed services render; disallowed ones are absent", async () => {
    mockServices([
      SERVICE("svc-1", "استشارة زوجية"),
      SERVICE("svc-2", "استشارة أسرية"),
      SERVICE("svc-3", "جلسة فردية"),
    ])

    renderWithQueryClient(
      <StepService
        categoryId="cat-1"
        onSelect={vi.fn()}
        isServiceAllowed={(id) => id === "svc-1" || id === "svc-3"}
      />
    )

    expect(await screen.findByText("استشارة زوجية")).toBeInTheDocument()
    expect(screen.getByText("جلسة فردية")).toBeInTheDocument()
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()
    expect(screen.queryByTestId("step-service-empty")).not.toBeInTheDocument()
    expect(screen.queryByTestId("step-service-no-results")).not.toBeInTheDocument()
  })
})

/* (b) Bug regression — predicate + some allowed + missed search. */

describe("StepService — predicate + missed search keeps the search input mounted", () => {
  it("(b) search input STILL mounted, step-service-no-results shown, step-service-empty NOT shown", async () => {
    mockServices([
      SERVICE("svc-1", "استشارة زوجية"),
      SERVICE("svc-3", "جلسة فردية"),
    ])

    renderWithQueryClient(
      <StepService
        categoryId="cat-1"
        onSelect={vi.fn()}
        isServiceAllowed={(id) => id === "svc-1" || id === "svc-3"}
      />
    )

    await screen.findByText("استشارة زوجية")
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement
    fireEvent.change(input, { target: { value: "ZZZ لا شيء" } })

    // 1. Search input STILL mounted (the bug unmounted it).
    expect(input).toBeInTheDocument()
    // 2. step-service-no-results shows the AR bookings.client.search.noResults copy.
    const noResults = await screen.findByTestId("step-service-no-results")
    expect(noResults.textContent ?? "").toContain(NO_RESULTS)
    // 3. step-service-empty is NOT shown.
    expect(screen.queryByTestId("step-service-empty")).not.toBeInTheDocument()
    // 4. Both cards are filtered out by the search.
    expect(screen.queryByText("استشارة زوجية")).not.toBeInTheDocument()
    expect(screen.queryByText("جلسة فردية")).not.toBeInTheDocument()

    // Clearing the query restores the original cards.
    fireEvent.change(input, { target: { value: "" } })
    await waitFor(() => {
      expect(screen.getByText("استشارة زوجية")).toBeInTheDocument()
      expect(screen.getByText("جلسة فردية")).toBeInTheDocument()
    })
    expect(screen.queryByTestId("step-service-no-results")).not.toBeInTheDocument()
  })
})

/* (c) Predicate rejects everything → step-service-empty. */

describe("StepService — predicate that rejects everything", () => {
  it("(c) renders step-service-empty with the filter.noOptions copy; search input is omitted", async () => {
    mockServices([
      SERVICE("svc-1", "استشارة زوجية"),
      SERVICE("svc-2", "استشارة أسرية"),
    ])

    renderWithQueryClient(
      <StepService categoryId="cat-1" onSelect={vi.fn()} isServiceAllowed={() => false} />
    )

    const empty = await screen.findByTestId("step-service-empty")
    expect(empty.textContent ?? "").toContain(PKG_NO_OPTIONS)
    expect(screen.queryByText("استشارة زوجية")).not.toBeInTheDocument()
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()
    expect(screen.queryByTestId("step-service-no-results")).not.toBeInTheDocument()
    // Search input intentionally omitted — searching an empty set is pointless.
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).not.toBeInTheDocument()
  })
})

/* (d) Search cannot bypass the predicate. */

describe("StepService — search is INNER, predicate is OUTER", () => {
  it("(d) a search query that matches a DISALLOWED service by name does NOT surface that service", async () => {
    // svc-1 is allowed, svc-2 is not. Search must run over the pre-filtered list.
    mockServices([
      SERVICE("svc-1", "استشارة زوجية", "Couples Counseling"),
      SERVICE("svc-2", "استشارة أسرية", "Family Counseling"),
    ])

    renderWithQueryClient(
      <StepService
        categoryId="cat-1"
        onSelect={vi.fn()}
        isServiceAllowed={(id) => id === "svc-1"}
      />
    )

    await screen.findByText("استشارة زوجية")
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement

    // Arabic name of the DISALLOWED service — must NOT be resurrected.
    fireEvent.change(input, { target: { value: "استشارة أسرية" } })
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()
    expect(screen.queryByText("استشارة زوجية")).not.toBeInTheDocument()
    const noResults = await screen.findByTestId("step-service-no-results")
    expect(noResults.textContent ?? "").toContain(NO_RESULTS)

    // Same guarantee for the English name.
    fireEvent.change(input, { target: { value: "Family" } })
    expect(screen.queryByText("Family Counseling")).not.toBeInTheDocument()
    expect(screen.queryByText("Couples Counseling")).not.toBeInTheDocument()
  })
})

/* (e) NO predicate — today's UNRESTRICTED behaviour preserved. */

describe("StepService — no predicate, today's unrestricted behaviour preserved", () => {
  it("(e1) every service renders when no predicate is supplied", async () => {
    mockServices([
      SERVICE("svc-1", "استشارة زوجية"),
      SERVICE("svc-2", "استشارة أسرية"),
      SERVICE("svc-3", "جلسة فردية"),
    ])

    renderWithQueryClient(<StepService categoryId="cat-1" onSelect={vi.fn()} />)

    expect(await screen.findByText("استشارة زوجية")).toBeInTheDocument()
    expect(screen.getByText("استشارة أسرية")).toBeInTheDocument()
    expect(screen.getByText("جلسة فردية")).toBeInTheDocument()
    expect(screen.queryByTestId("step-service-empty")).not.toBeInTheDocument()
    expect(screen.queryByTestId("step-service-no-results")).not.toBeInTheDocument()
  })

  it("(e2) with NO predicate and a no-match search, the search input stays mounted AND no new empty state is rendered — exactly today's unrestricted behaviour", async () => {
    mockServices([
      SERVICE("svc-1", "استشارة زوجية"),
      SERVICE("svc-2", "استشارة أسرية"),
    ])

    renderWithQueryClient(<StepService categoryId="cat-1" onSelect={vi.fn()} />)

    await screen.findByText("استشارة زوجية")
    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER) as HTMLInputElement
    fireEvent.change(input, { target: { value: "ZZZ لا شيء" } })

    expect(input).toBeInTheDocument()
    expect(screen.queryByTestId("step-service-empty")).not.toBeInTheDocument()
    expect(screen.queryByTestId("step-service-no-results")).not.toBeInTheDocument()
    expect(screen.queryByText("استشارة زوجية")).not.toBeInTheDocument()
    expect(screen.queryByText("استشارة أسرية")).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "" } })
    await waitFor(() => {
      expect(screen.getByText("استشارة زوجية")).toBeInTheDocument()
      expect(screen.getByText("استشارة أسرية")).toBeInTheDocument()
    })
  })
})
