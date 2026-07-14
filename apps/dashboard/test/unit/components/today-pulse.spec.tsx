/**
 * TodayPulse — unit tests
 *
 * TodayPulse is a 4-tile strip showing today's booking counts
 * (total, confirmed, pending, awaiting_payment). The component is
 * purely presentational: it takes the four counts and a visibility
 * flag as props and renders the strip — it does NOT fetch.
 *
 * Covers:
 *  - Renders nothing when visible is false
 *  - Renders exactly four tiles with the supplied counts when visible
 *  - Each tile's label resolves through t() (locale-aware)
 *  - Renders locale-specific translation strings (ar + en parity)
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

const localeState = vi.fn<() => "ar" | "en">(() => "ar")
const tMap: Record<string, { ar: string; en: string }> = {
  "dashboard.todayPulse.title": { ar: "نبض اليوم", en: "Today's Pulse" },
  "dashboard.todayPulse.total": { ar: "إجمالي اليوم", en: "Today's total" },
  "dashboard.todayPulse.confirmed": { ar: "مؤكدة", en: "Confirmed" },
  "dashboard.todayPulse.pending": { ar: "بانتظار", en: "Pending" },
  "dashboard.todayPulse.awaitingPayment": {
    ar: "بانتظار الدفع",
    en: "Awaiting payment",
  },
}

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: localeState(),
    dir: localeState() === "ar" ? ("rtl" as const) : ("ltr" as const),
    t: (k: string) => tMap[k]?.[localeState()] ?? k,
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

import { TodayPulse } from "@/components/features/dashboard/today-pulse"

beforeEach(() => {
  localeState.mockReturnValue("ar")
})

describe("TodayPulse", () => {
  it("renders nothing when visible is false", () => {
    const { container } = render(
      <TodayPulse
        visible={false}
        total={12}
        confirmed={3}
        pending={5}
        awaitingPayment={2}
      />,
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders four tiles with the supplied counts (ar)", () => {
    localeState.mockReturnValue("ar")
    render(
      <TodayPulse
        visible
        total={12}
        confirmed={3}
        pending={5}
        awaitingPayment={2}
      />,
    )

    expect(screen.getByTestId("today-pulse")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("إجمالي اليوم")).toBeInTheDocument()
    expect(screen.getByText("مؤكدة")).toBeInTheDocument()
    expect(screen.getByText("بانتظار")).toBeInTheDocument()
    expect(screen.getByText("بانتظار الدفع")).toBeInTheDocument()
  })

  it("renders the localized English labels (en)", () => {
    localeState.mockReturnValue("en")
    render(
      <TodayPulse
        visible
        total={12}
        confirmed={3}
        pending={5}
        awaitingPayment={2}
      />,
    )

    expect(screen.getByText("Today's total")).toBeInTheDocument()
    expect(screen.getByText("Confirmed")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument()
  })

  it("renders zeros (no NaN / blank) when counts are 0", () => {
    localeState.mockReturnValue("ar")
    const { container } = render(
      <TodayPulse
        visible
        total={0}
        confirmed={0}
        pending={0}
        awaitingPayment={0}
      />,
    )
    // Container must have rendered something (the strip)
    expect(container.firstChild).not.toBeNull()
    // 4 zero labels must be present
    const zeros = screen.getAllByText("0")
    expect(zeros.length).toBe(4)
  })
})