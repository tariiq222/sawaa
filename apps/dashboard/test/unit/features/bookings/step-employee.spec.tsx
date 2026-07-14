/**
 * step-employee.spec.tsx — Real-tree tests for the practitioner-card
 * "nearest slot" hint. Only the network layer + heavy UI primitives
 * are stubbed; StepEmployee and its hook are real. See CLAUDE.md
 * "UI verification bar".
 */

import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { StepEmployee } from "@/components/features/bookings/wizard-steps/step-employee"

const tMap: Record<string, { ar: string; en: string }> = {
  "bookings.wizard.noEmployees": { ar: "لا يوجد ممارسون متاحون", en: "No practitioners available" },
  "bookings.pos.disabled.employee": { ar: "لا يوجد وقت متاح", en: "No time available" },
  "bookings.wizard.step.employee.availableToday": { ar: "متاح اليوم", en: "Available today" },
  "bookings.wizard.step.employee.nextAvailable": { ar: "أقرب موعد", en: "Next available" },
  "bookings.wizard.step.typeDuration.inPerson": { ar: "حضوري", en: "In Person" },
  "bookings.wizard.step.typeDuration.online": { ar: "عن بعد", en: "Online" },
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

const { fetchAvailability, fetchAvailableDays, fetchSlots } = vi.hoisted(() => ({
  fetchAvailability: vi.fn(),
  fetchAvailableDays: vi.fn(),
  fetchSlots: vi.fn(),
}))
const { fetchServiceEmployees, fetchEmployees } = vi.hoisted(() => ({
  fetchServiceEmployees: vi.fn(),
  fetchEmployees: vi.fn(),
}))
vi.mock("@/lib/api/employees-schedule", () => ({
  fetchAvailability,
  fetchAvailableDays,
  fetchSlots,
  fetchEmployeeServices: vi.fn(() => Promise.resolve([])),
  fetchEmployeeServiceTypes: vi.fn(() => Promise.resolve([])),
}))
vi.mock("@/lib/api/services", () => ({ fetchServiceEmployees }))
vi.mock("@/lib/api/employees", () => ({ fetchEmployees }))

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}))
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))

const PRACTITIONER = {
  id: "emp-1", ref: 1, userId: "user-1", title: null,
  nameAr: "أحمد", specialty: "", specialtyAr: null,
  bio: null, bioAr: null, experience: null, education: null, educationAr: null,
  isActive: true, avatarUrl: null, slug: null, isPublic: false,
  publicBioAr: null, publicBioEn: null, publicImageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  user: { id: "user-1", firstName: "Ahmad", lastName: "S", email: "a@b.test", phone: null },
} as const

const svcType = (deliveryType: "IN_PERSON" | "ONLINE", idSuffix: string) => ({
  id: `st-${idSuffix}`,
  deliveryType,
  price: deliveryType === "IN_PERSON" ? 15000 : 12000,
  durationMins: 60,
  isActive: true,
  basePrice: deliveryType === "IN_PERSON" ? 15000 : 12000,
  baseDurationMins: 60,
  isCustom: false,
})

const SERVICE_EMPLOYEE = {
  id: "es-1",
  employee: {
    id: PRACTITIONER.id, nameAr: PRACTITIONER.nameAr, title: null,
    avatarUrl: null, isActive: true, user: PRACTITIONER.user,
  },
  serviceTypes: [svcType("IN_PERSON", "inperson")],
  customDuration: 60, bufferMinutes: 0,
  availableTypes: ["IN_PERSON"], isActive: true, hasCustomPricing: false,
} as const

// Same practitioner, BOTH modalities — used to prove the hint picks
// the truly earliest slot, not the preferred-delivery-type default.
const SERVICE_EMPLOYEE_BOTH = {
  ...SERVICE_EMPLOYEE,
  id: "es-2",
  serviceTypes: [
    svcType("IN_PERSON", "inperson"),
    svcType("ONLINE", "online"),
  ],
  availableTypes: ["IN_PERSON", "ONLINE"],
} as const

function renderStep() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
  const onSelect = vi.fn()
  const wrapper = render(
    <QueryClientProvider client={queryClient}>
      <StepEmployee serviceId="svc-1" onSelect={onSelect} />
    </QueryClientProvider>,
  )
  return { ...wrapper, onSelect, queryClient }
}

function setupSingle(weekly: Array<{ isActive: boolean }> = [{ isActive: true }]) {
  fetchServiceEmployees.mockResolvedValue([SERVICE_EMPLOYEE])
  fetchEmployees.mockResolvedValue({ items: [], meta: {} })
  fetchAvailability.mockResolvedValue(weekly)
}

function riyadhToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${value.year}-${value.month}-${value.day}`
}

// React's font/image rendering + locale stub means the rendered tree
// contains both Arabic label + English slot time. We test on the AR
// locale to mirror the production RTL view.
function setupBoth(daysByType: Record<string, string[]>, slotsByType: Record<string, string>) {
  fetchServiceEmployees.mockResolvedValue([SERVICE_EMPLOYEE_BOTH])
  fetchEmployees.mockResolvedValue({ items: [], meta: {} })
  fetchAvailability.mockResolvedValue([{ isActive: true }])
  fetchAvailableDays.mockImplementation(
    async (_e: string, _s: string, opts?: { deliveryType?: string }) =>
      daysByType[opts?.deliveryType ?? ""] ?? [],
  )
  fetchSlots.mockImplementation(
    async (_e: string, _d: string, _du: unknown, opts?: { deliveryType?: string }) => {
      const start = slotsByType[opts?.deliveryType ?? ""]
      return start ? [{ startTime: start, endTime: "07:00" }] : []
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  currentLocale = "ar"
})

describe("StepEmployee — nearest slot hint", () => {
  it("renders today's hint with Riyadh wall-clock time", async () => {
    setupSingle()
    fetchAvailableDays.mockResolvedValue([riyadhToday()])
    fetchSlots.mockResolvedValue([{ startTime: "06:00", endTime: "07:00" }]) // 06:00 UTC → 09:00 Riyadh
    renderStep()
    expect(await screen.findByText("أحمد")).toBeInTheDocument()
    const hint = await screen.findByTestId("step-employee-nearest-slot")
    expect(hint).toHaveTextContent("متاح اليوم")
    expect(hint.textContent).toMatch(/09:00/)
  })

  it("renders 'nextAvailable' label with date when slot is on a future day", async () => {
    setupSingle()
    fetchAvailableDays.mockResolvedValue(["2026-07-04"])
    fetchSlots.mockResolvedValue([{ startTime: "08:00", endTime: "09:00" }])
    renderStep()
    expect(
      await screen.findByTestId("step-employee-nearest-slot"),
    ).toHaveTextContent("أقرب موعد")
  })

  it("hides the hint line when no active serviceTypes resolve to a slot", async () => {
    setupSingle()
    fetchAvailableDays.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])
    renderStep()
    expect(await screen.findByText("أحمد")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId("step-employee-nearest-slot")).not.toBeInTheDocument()
    })
  })

  it("does not auto-select any delivery type or duration", async () => {
    setupSingle()
    fetchAvailableDays.mockResolvedValue(["2026-07-03"])
    fetchSlots.mockResolvedValue([{ startTime: "06:00", endTime: "07:00" }])
    const { onSelect } = renderStep()
    await screen.findByTestId("step-employee-nearest-slot")
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("keeps the disabled-card behavior + hidden hint when no weekly availability", async () => {
    setupSingle([{ isActive: false }])
    fetchAvailableDays.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])
    renderStep()
    const card = (await screen.findByText("أحمد")).closest("button")
    expect(card).toBeDisabled()
    expect(card?.getAttribute("title")).toBe("لا يوجد وقت متاح")
    expect(screen.queryByTestId("step-employee-nearest-slot")).not.toBeInTheDocument()
  })

  it("picks the truly earliest slot across both modalities when dates differ", async () => {
    // ONLINE 2026-07-04 @ 08:00 UTC (~4 days earlier than IN_PERSON's
    // 2026-07-08 @ 06:00 UTC) must win on the absolute UTC slot axis.
    setupBoth(
      { IN_PERSON: ["2026-07-08"], ONLINE: ["2026-07-04"] },
      { IN_PERSON: "06:00", ONLINE: "08:00" },
    )
    renderStep()
    const hint = await screen.findByTestId("step-employee-nearest-slot")
    expect(hint.textContent).toContain("عن بعد")
    expect(hint.textContent).not.toContain("حضوري")
    expect(hint.textContent).toMatch(/11:00/) // 08:00 UTC → 11:00 Riyadh
    expect(hint.textContent).not.toMatch(/09:00/)
    expect(hint.textContent).toContain("أقرب موعد")
  })

  it("picks ONLINE when both modalities share the same earliest date but ONLINE's slot is earlier", async () => {
    // Bug coverage: previous logic short-circuited on same-date and
    // forced IN_PERSON, surfacing a later wall-clock time. The hint
    // must compare actual slot start times across modalities.
    setupBoth(
      { IN_PERSON: ["2026-07-08"], ONLINE: ["2026-07-08"] },
      { IN_PERSON: "10:00", ONLINE: "06:00" },
    )
    renderStep()
    const hint = await screen.findByTestId("step-employee-nearest-slot")
    expect(hint.textContent).toContain("عن بعد")
    expect(hint.textContent).not.toContain("حضوري")
    expect(hint.textContent).toMatch(/09:00/)   // 06:00 UTC → 09:00 Riyadh
    expect(hint.textContent).not.toMatch(/13:00/) // IN_PERSON 10:00 UTC → 13:00 Riyadh
  })

  it("picks IN_PERSON by deterministic tiebreak only when date and time are equal", async () => {
    // Same date and identical UTC start → only true tie → IN_PERSON.
    setupBoth(
      { IN_PERSON: ["2026-07-08"], ONLINE: ["2026-07-08"] },
      { IN_PERSON: "06:00", ONLINE: "06:00" },
    )
    renderStep()
    const hint = await screen.findByTestId("step-employee-nearest-slot")
    expect(hint.textContent).toContain("حضوري")
    expect(hint.textContent).toMatch(/09:00/)
  })

  it("does not fetch nearest-slot data when no serviceId is provided", async () => {
    fetchEmployees.mockResolvedValue({
      items: [PRACTITIONER],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    })
    fetchAvailability.mockResolvedValue([{ isActive: true }])
    fetchAvailableDays.mockResolvedValue([])
    fetchSlots.mockResolvedValue([])
    render(
      <QueryClientProvider
        client={new QueryClient({
          defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
        })}
      >
        <StepEmployee serviceId="" onSelect={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText("أحمد")).toBeInTheDocument()
    expect(screen.queryByTestId("step-employee-nearest-slot")).not.toBeInTheDocument()
    expect(fetchAvailableDays).not.toHaveBeenCalled()
    expect(fetchSlots).not.toHaveBeenCalled()
  })
})
