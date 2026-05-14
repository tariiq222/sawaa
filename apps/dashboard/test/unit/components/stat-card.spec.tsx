import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatCard } from "@/components/features/stat-card"
import { Calendar01Icon } from "@hugeicons/core-free-icons"

describe("StatCard", () => {
  it("renders title and numeric value", () => {
    render(<StatCard title="الحجوزات" value={42} />)
    expect(screen.getByText("42")).toBeInTheDocument()
    expect(screen.getByText("الحجوزات")).toBeInTheDocument()
  })

  it("renders string value", () => {
    render(<StatCard title="الحالة" value="نشط" />)
    expect(screen.getByText("نشط")).toBeInTheDocument()
  })

  it("renders description when provided", () => {
    render(<StatCard title="الإيرادات" value={1000} description="هذا الشهر" />)
    expect(screen.getByText(/هذا الشهر/)).toBeInTheDocument()
  })

  it("renders positive trend", () => {
    render(<StatCard title="النمو" value={15} trend={{ value: "12%", positive: true }} />)
    const trend = screen.getByText(/12%/)
    expect(trend).toBeInTheDocument()
    expect(trend.textContent).toContain("↑")
  })

  it("renders negative trend", () => {
    render(<StatCard title="النمو" value={15} trend={{ value: "5%", positive: false }} />)
    const trend = screen.getByText(/5%/)
    expect(trend).toBeInTheDocument()
    expect(trend.textContent).toContain("↓")
  })

  it("renders icon when provided", () => {
    const { container } = render(<StatCard title="حجوزات" value={5} icon={Calendar01Icon} />)
    const svg = container.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("formats number with locale", () => {
    render(<StatCard title="المبلغ" value={12345} />)
    expect(screen.getByText("12,345")).toBeInTheDocument()
  })
})
