import type { ReactNode } from "react"
import { render } from "@testing-library/react"
import { it, expect, vi } from "vitest"
const { chart } = vi.hoisted(() => ({ chart: vi.fn() }))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (s: string) => s }),
}))
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  AreaChart: ({
    data,
    children,
  }: {
    data: Array<Record<string, string | number | null>>
    children: ReactNode
  }) => {
    chart(data)
    return <svg>{children}</svg>
  },
  Area: () => null,
  Line: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))
import { TrendChart } from "@/components/features/reports/trend-chart"
it("aligns previous values by calendar offset when daily points have gaps", () => {
  render(
    <TrendChart
      data={[
        { date: "2026-10-10", revenue: 49.5 },
        { date: "2026-10-12", revenue: 30 },
      ]}
      previous={[
        { date: "2026-10-07", revenue: 20 },
        { date: "2026-10-08", revenue: 70 },
      ]}
      series={[{ key: "revenue", label: "SAR", color: "var(--chart-1)" }]}
      currentFrom="2026-10-10"
      previousFrom="2026-10-07"
    />
  )
  expect(chart.mock.calls.at(-1)![0][1].revenue_prev).toBeNull()
})

it("keeps empty previous-period data as gaps", () => {
  render(
    <TrendChart
      data={[{ date: "2026-10-10", revenue: 49.5 }]}
      previous={[]}
      series={[{ key: "revenue", label: "SAR", color: "var(--chart-1)" }]}
    />
  )
  expect(chart.mock.calls.at(-1)![0][0].revenue_prev).toBeNull()
})
