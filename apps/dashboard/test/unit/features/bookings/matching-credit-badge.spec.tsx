import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const query = vi.hoisted(() => ({ isLoading: true, data: [] as Array<{ creditId: string; remaining: number }> }))
vi.mock("@/hooks/use-credit-bookings", () => ({ useMatchingCredits: () => query }))
vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (key: string) => key }) }))
import { MatchingCreditBadge } from "@/components/features/bookings/matching-credit-badge"

describe("MatchingCreditBadge", () => {
  it("offers no action until a concrete credit loads, then selects that credit", () => {
    const onAccept = vi.fn()
    const props = { clientId: "client", serviceId: "service", employeeId: "employee", durationOptionId: "duration", useCredit: false, dismissed: false, onAccept, onDismiss: vi.fn() }
    const { rerender } = render(<MatchingCreditBadge {...props} />)
    expect(screen.queryByTestId("matching-credit-accept")).not.toBeInTheDocument()
    query.isLoading = false
    query.data = [{ creditId: "session-2", remaining: 1 }]
    rerender(<MatchingCreditBadge {...props} />)
    fireEvent.click(screen.getByTestId("matching-credit-accept"))
    expect(onAccept).toHaveBeenCalledWith("session-2")
  })
})
