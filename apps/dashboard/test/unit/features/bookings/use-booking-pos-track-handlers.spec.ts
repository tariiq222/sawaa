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
  test("fills the target and switches the booking to the package credit", () => {
    const params = buildParams()
    const handlers = useBookingPosTrackHandlers(params)

    handlers.handleUseCredit(target)

    expect(params.applyCreditTarget).toHaveBeenCalledWith(target)
    // Without this the wizard would create a paid booking the client already
    // covered with their package.
    expect(params.setUseCredit).toHaveBeenCalledWith(true)
    expect(params.setCreditDismissed).toHaveBeenCalledWith(false)
    expect(params.setOpenSection).toHaveBeenCalledWith("typeDuration")
  })
})
