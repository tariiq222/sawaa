import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"

describe("StatsGrid", () => {
  it("renders children", () => {
    render(
      <StatsGrid>
        <StatCard title="حجوزات" value={10} />
        <StatCard title="مرضى" value={20} />
      </StatsGrid>,
    )
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("20")).toBeInTheDocument()
  })

  it("renders all stat cards", () => {
    render(
      <StatsGrid>
        <StatCard title="أ" value={1} />
        <StatCard title="ب" value={2} />
        <StatCard title="ج" value={3} />
        <StatCard title="د" value={4} />
      </StatsGrid>,
    )
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
  })
})
