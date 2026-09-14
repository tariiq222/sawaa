import { describe, expect, it } from "vitest"

import {
  creditDedupeKey,
  filterUsableCredits,
  isJumpableCredit,
  isCreditBookable,
  creditAvailabilityReason,
} from "@/lib/package-credit-usability"
import type { PackageCredit } from "@/lib/types/package-purchase"

const credit = (over: Partial<PackageCredit> = {}) => ({
  id: "credit-1",
  serviceId: "service-1",
  employeeId: "employee-1",
  durationOptionId: "duration-1",
  serviceNameAr: "Service",
  serviceNameEn: null,
  employeeNameAr: "Practitioner",
  employeeNameEn: null,
  durationLabelAr: "45 min",
  durationLabelEn: "45 min",
  durationMins: 45,
  unitPriceSnapshot: 100,
  totalQuantity: 1,
  usedQuantity: 0,
  reservedQuantity: 0,
  remaining: 1,
  categoryId: "category-1",
  categoryNameAr: "Category",
  categoryNameEn: null,
  categoryBookingMode: "SERVICES" as const,
  departmentId: "department-1",
  departmentNameAr: "Department",
  departmentNameEn: null,
  serviceIsBookable: true,
  constraints: [],
  ...over,
}) as PackageCredit

describe("package credit usability", () => {
  it("keeps grouped V2 sessions distinct even when their routing triple matches", () => {
    const first = credit({ id: "session-1", purchaseGroupId: "group-1", sessionPosition: 0 })
    const second = credit({ id: "session-2", purchaseGroupId: "group-1", sessionPosition: 1 })

    expect(creditDedupeKey(first, "GROUPED_V2")).not.toBe(creditDedupeKey(second, "GROUPED_V2"))
    expect(filterUsableCredits([first, second], "GROUPED_V2")).toHaveLength(2)
  })

  it("preserves a locked grouped session for an explanatory disabled card", () => {
    const locked = credit({
      id: "session-2",
      purchaseGroupId: "group-1",
      sessionPosition: 1,
      remaining: 0,
      usedQuantity: 0,
      availability: { bookable: false, reason: "PREDECESSOR_INCOMPLETE" },
    })

    expect(filterUsableCredits([locked], "GROUPED_V2")).toEqual([locked])
    expect(isJumpableCredit(locked)).toBe(false)
  })

  it("keeps legacy triple deduplication unchanged", () => {
    const first = credit({ id: "legacy-1" })
    const second = credit({ id: "legacy-2" })

    expect(creditDedupeKey(first)).toBe(creditDedupeKey(second))
    expect(filterUsableCredits([first, second])).toHaveLength(1)
  })

  it("requires authoritative availability for a grouped session", () => {
    expect(isCreditBookable(credit({ purchaseGroupId: "group-1" }))).toBe(false)
    expect(isCreditBookable(credit({ purchaseGroupId: "group-1", availability: { bookable: true, reason: null } }))).toBe(true)
    expect(isCreditBookable(credit())).toBe(true)
  })

  it("recognizes a dependency lock reason", () => {
    expect(creditAvailabilityReason(credit({
      availability: { bookable: false, reason: "DEPENDENCY_INCOMPLETE" },
    }))).toBe("DEPENDENCY_INCOMPLETE")
  })
})
