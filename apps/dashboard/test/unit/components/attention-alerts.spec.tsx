import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { AttentionAlerts } from "@/components/features/dashboard/attention-alerts"

const visibleBoth = { pendingPayments: true, cancelRequests: true }
const visibleNone = { pendingPayments: false, cancelRequests: false }

describe("AttentionAlerts", () => {
  it("renders nothing when both counts are 0", () => {
    const { container } = render(
      <AttentionAlerts pendingPayments={0} cancelRequests={0} visible={visibleBoth} />
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders nothing when not visible", () => {
    const { container } = render(
      <AttentionAlerts pendingPayments={5} cancelRequests={3} visible={visibleNone} />
    )
    expect(container.innerHTML).toBe("")
  })

  it("renders pending payments alert when count > 0 and visible", () => {
    render(
      <AttentionAlerts pendingPayments={3} cancelRequests={0} visible={visibleBoth} />
    )
    expect(screen.getByTestId("alert-pending-payments")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("renders cancel requests alert when count > 0 and visible", () => {
    render(
      <AttentionAlerts pendingPayments={0} cancelRequests={2} visible={visibleBoth} />
    )
    expect(screen.getByTestId("alert-cancel-requests")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("renders both alerts", () => {
    render(
      <AttentionAlerts pendingPayments={4} cancelRequests={1} visible={visibleBoth} />
    )
    expect(screen.getByTestId("alert-pending-payments")).toBeInTheDocument()
    expect(screen.getByTestId("alert-cancel-requests")).toBeInTheDocument()
  })
})
