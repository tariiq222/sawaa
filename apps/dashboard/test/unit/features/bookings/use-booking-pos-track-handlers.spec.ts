import { describe, expect, test, vi } from "vitest"
import { useBookingPosTrackHandlers } from "@/components/features/bookings/use-booking-pos-track-handlers"
import type { CreditTarget } from "@/components/features/bookings/use-booking-form-state"

const target: CreditTarget = {
  departmentId: null,
  departmentName: null,
  categoryId: "cat1",
  categoryName: "عيادة السعادة",
  categoryBookingMode: "DIRECT",
  serviceId: "svc1",
  serviceName: "عيادة السعادة",
  employeeId: "emp1",
  employeeName: "د. خالد",
  durationOptionId: "dur1",
}

function buildParams() {
  return {
    setOpenSection: vi.fn(),
    setUseCredit: vi.fn(),
    setCreditDismissed: vi.fn(),
    reset: vi.fn(),
    onSuccess: vi.fn(),
    applyCreditTarget: vi.fn(),
    selectTrack: vi.fn(),
    applyPackageCreditTarget: vi.fn(),
    applyCreditFilter: vi.fn(),
    clearCreditFilter: vi.fn(),
    selectProgram: vi.fn(),
  }
}

describe("useBookingPosTrackHandlers — spending a credit from the client panel", () => {
  // Regression: the client-credits panel used to jump-fill the target
  // without ever selecting a track, so the wizard stayed on no track and
  // rendered no النوع/الموعد sections at all — a dead end. The panel button
  // must converge on the exact same state as the designed PACKAGES-track
  // path (handlePackageCreditSelected), packagePurchaseId included, so
  // submit hits /from-credit instead of creating a paid booking.
  test("selects the PACKAGES track and fills the target via the package-credit path", () => {
    const params = buildParams()
    const handlers = useBookingPosTrackHandlers(params)

    handlers.handleUseCredit(target, "purchase1")

    expect(params.selectTrack).toHaveBeenCalledWith("PACKAGES")
    expect(params.applyPackageCreditTarget).toHaveBeenCalledWith(target, "purchase1")
    // Without this the wizard would create a paid booking the client already
    // covered with their package.
    expect(params.setUseCredit).toHaveBeenCalledWith(true)
    expect(params.setCreditDismissed).toHaveBeenCalledWith(false)
    expect(params.setOpenSection).toHaveBeenCalledWith("typeDuration")
  })
})
