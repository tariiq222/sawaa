import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    locale: "ar",
    dir: "rtl" as const,
    t: (k: string) => k,
    toggleLocale: vi.fn(),
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock("@deqah/ui", () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}))

import { QuickActions } from "@/components/features/dashboard/quick-actions"
import type { QuickActionKey } from "@/lib/dashboard-widgets"

describe("QuickActions", () => {
  it("renders nothing when actions array is empty", () => {
    const { container } = render(<QuickActions actions={[]} />)
    expect(container.innerHTML).toBe("")
  })

  it("renders a link for each action key", () => {
    const actions: QuickActionKey[] = ["newBooking", "newClient"]
    render(<QuickActions actions={actions} />)
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })

  it("renders newBooking with correct href", () => {
    render(<QuickActions actions={["newBooking"]} />)
    expect(screen.getByTestId("quick-action-newBooking")).toHaveAttribute("href", "/bookings?new=1")
  })

  it("renders newClient with correct href", () => {
    render(<QuickActions actions={["newClient"]} />)
    expect(screen.getByTestId("quick-action-newClient")).toHaveAttribute("href", "/clients?new=1")
  })

  it("renders recordPayment with correct href", () => {
    render(<QuickActions actions={["recordPayment"]} />)
    expect(screen.getByTestId("quick-action-recordPayment")).toHaveAttribute("href", "/payments?new=1")
  })

  it("renders all three actions", () => {
    const actions: QuickActionKey[] = ["newBooking", "newClient", "recordPayment"]
    render(<QuickActions actions={actions} />)
    expect(screen.getByTestId("quick-actions").querySelectorAll("a")).toHaveLength(3)
  })
})
