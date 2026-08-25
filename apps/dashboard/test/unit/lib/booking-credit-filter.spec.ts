import { describe, expect, it } from "vitest"
import {
  buildCreditFilter,
  creditFilterPredicates,
  isDeliveryTypeAllowed,
  isDurationAllowed,
  isEmployeeAllowed,
  isServiceAllowed,
} from "@/lib/booking-credit-filter"
import type { CreditFilter } from "@/lib/booking-credit-filter"
import type {
  CreditConstraintDimension,
  CreditConstraintMode,
  PackageCreditConstraint,
} from "@/lib/types/package-purchase"

const SVC = "svc-1"
const SVC2 = "svc-2"
const EMP = "emp-1"
const EMP2 = "emp-2"
const DUR = "dur-1"
const DUR2 = "dur-2"
const DELIVERY = "ONLINE"
const DELIVERY2 = "IN_PERSON"

const row = (
  dimension: CreditConstraintDimension,
  mode: CreditConstraintMode,
  ids: string[] = [],
): PackageCreditConstraint => ({ dimension, mode, targetIds: ids })

const inc = (dimension: CreditConstraintDimension, ids: string[]) =>
  row(dimension, "INCLUDE", ids)
const exc = (dimension: CreditConstraintDimension, ids: string[]) =>
  row(dimension, "EXCLUDE", ids)
const any = (dimension: CreditConstraintDimension) => row(dimension, "ANY")

const source = (over: Partial<{
  id: string
  constraints: PackageCreditConstraint[]
  serviceId?: string | null
  employeeId?: string | null
  durationOptionId?: string | null
}> = {}) => ({
  id: "credit-1",
  constraints: [] as PackageCreditConstraint[],
  serviceId: null,
  employeeId: null,
  durationOptionId: null,
  ...over,
})

const filterFrom = (over: Parameters<typeof source>[0] = {}): CreditFilter =>
  buildCreditFilter(source(over), "purchase-1", "باقة استشارات")

describe("buildCreditFilter", () => {
  it("copies the constraints array (later mutation does not leak into the filter)", () => {
    const constraints: PackageCreditConstraint[] = [inc("SERVICE", [SVC])]
    const filter = buildCreditFilter(
      source({ constraints, serviceId: SVC, employeeId: EMP, durationOptionId: DUR }),
      "purchase-1",
      "باقة",
    )
    expect(filter.constraints).toEqual(constraints)
    expect(filter.constraints).not.toBe(constraints)
    // Mutate the source array after the build — the filter must not change.
    constraints.push(exc("DURATION", [DUR2]))
    expect(filter.constraints).toHaveLength(1)
  })

  it("normalises an undefined triple member to null", () => {
    const filter = buildCreditFilter(
      // The widened shape allows the field to be missing entirely.
      source({ constraints: [], serviceId: SVC, employeeId: EMP }),
      "purchase-1",
      "باقة",
    )
    expect(filter.serviceId).toBe(SVC)
    expect(filter.employeeId).toBe(EMP)
    expect(filter.durationOptionId).toBeNull()
  })

  it("preserves a null triple member verbatim", () => {
    const filter = buildCreditFilter(
      source({ serviceId: null, employeeId: null, durationOptionId: null }),
      "purchase-1",
      "باقة",
    )
    expect(filter.serviceId).toBeNull()
    expect(filter.employeeId).toBeNull()
    expect(filter.durationOptionId).toBeNull()
  })

  it("captures packagePurchaseId, creditId, packageName", () => {
    const filter = buildCreditFilter(
      source({ id: "credit-xyz" }),
      "purchase-7",
      "باقة استشارات",
    )
    expect(filter.packagePurchaseId).toBe("purchase-7")
    expect(filter.creditId).toBe("credit-xyz")
    expect(filter.packageName).toBe("باقة استشارات")
  })
})

describe("null filter means UNRESTRICTED", () => {
  it("every predicate returns true when the filter is null", () => {
    expect(isServiceAllowed(null, SVC)).toBe(true)
    expect(isEmployeeAllowed(null, EMP)).toBe(true)
    expect(isDurationAllowed(null, DUR)).toBe(true)
    expect(isDeliveryTypeAllowed(null, DELIVERY)).toBe(true)
    // Sanity: even ids the credit would never allow are accepted when no filter is set.
    expect(isServiceAllowed(null, "totally-unrelated")).toBe(true)
  })
})

describe("INCLUDE on SERVICE", () => {
  const filter = filterFrom({ constraints: [inc("SERVICE", [SVC])] })

  it("listed id passes", () => {
    expect(isServiceAllowed(filter, SVC)).toBe(true)
  })

  it("unlisted id fails", () => {
    expect(isServiceAllowed(filter, SVC2)).toBe(false)
  })

  it("does not bleed into other dimensions", () => {
    expect(isEmployeeAllowed(filter, EMP)).toBe(true)
    expect(isDurationAllowed(filter, DUR)).toBe(true)
    expect(isDeliveryTypeAllowed(filter, DELIVERY)).toBe(true)
  })
})

describe("EXCLUDE on PRACTITIONER", () => {
  const filter = filterFrom({
    constraints: [exc("PRACTITIONER", [EMP])],
  })

  it("listed id fails", () => {
    expect(isEmployeeAllowed(filter, EMP)).toBe(false)
  })

  it("unlisted id passes", () => {
    expect(isEmployeeAllowed(filter, EMP2)).toBe(true)
  })
})

describe("ANY on DURATION passes everything", () => {
  const filter = filterFrom({ constraints: [any("DURATION")] })

  it("any id passes", () => {
    expect(isDurationAllowed(filter, DUR)).toBe(true)
    expect(isDurationAllowed(filter, DUR2)).toBe(true)
    expect(isDurationAllowed(filter, "totally-unrelated")).toBe(true)
  })
})

describe("a dimension with NO row is unrestricted", () => {
  const filter = filterFrom({ constraints: [inc("SERVICE", [SVC])] })

  it("any id passes on DURATION", () => {
    expect(isDurationAllowed(filter, DUR)).toBe(true)
    expect(isDurationAllowed(filter, DUR2)).toBe(true)
  })

  it("any id passes on PRACTITIONER", () => {
    expect(isEmployeeAllowed(filter, EMP)).toBe(true)
    expect(isEmployeeAllowed(filter, EMP2)).toBe(true)
  })

  it("any deliveryType passes on DELIVERY_TYPE", () => {
    expect(isDeliveryTypeAllowed(filter, DELIVERY)).toBe(true)
    expect(isDeliveryTypeAllowed(filter, DELIVERY2)).toBe(true)
  })
})

describe("two rows on one dimension apply conjunctively", () => {
  const filter = filterFrom({
    constraints: [inc("SERVICE", [SVC, SVC2]), exc("SERVICE", [SVC])],
  })

  it("an id that passes INCLUDE but hits EXCLUDE is rejected", () => {
    expect(isServiceAllowed(filter, SVC)).toBe(false)
  })

  it("an id in INCLUDE and not in EXCLUDE passes", () => {
    expect(isServiceAllowed(filter, SVC2)).toBe(true)
  })
})

describe("legacy triple behaves as INCLUDE on each populated member", () => {
  // Empty constraints, but the legacy triple says "this credit is for one
  // service + one employee + one duration". `effectiveConstraints` synthesises
  // those rules and the predicates must consult them.
  const filter = filterFrom({
    constraints: [],
    serviceId: SVC,
    employeeId: EMP,
    durationOptionId: DUR,
  })

  it("pinned service id passes, a different one fails", () => {
    expect(isServiceAllowed(filter, SVC)).toBe(true)
    expect(isServiceAllowed(filter, SVC2)).toBe(false)
  })

  it("pinned employee id passes, a different one fails", () => {
    expect(isEmployeeAllowed(filter, EMP)).toBe(true)
    expect(isEmployeeAllowed(filter, EMP2)).toBe(false)
  })

  it("pinned duration id passes, a different one fails", () => {
    expect(isDurationAllowed(filter, DUR)).toBe(true)
    expect(isDurationAllowed(filter, DUR2)).toBe(false)
  })
})

describe("creditFilterPredicates", () => {
  it("returns null for a null filter (meaning: no restriction at all)", () => {
    expect(creditFilterPredicates(null)).toBeNull()
  })

  it("returns four bound functions that agree with the standalone predicates", () => {
    const filter = filterFrom({
      constraints: [
        inc("SERVICE", [SVC]),
        exc("PRACTITIONER", [EMP]),
        any("DURATION"),
        inc("DELIVERY_TYPE", [DELIVERY]),
      ],
    })
    const bound = creditFilterPredicates(filter)
    expect(bound).not.toBeNull()
    expect(bound!.isServiceAllowed(SVC)).toBe(true)
    expect(bound!.isServiceAllowed(SVC2)).toBe(false)
    expect(bound!.isEmployeeAllowed(EMP)).toBe(false)
    expect(bound!.isEmployeeAllowed(EMP2)).toBe(true)
    expect(bound!.isDurationAllowed(DUR)).toBe(true)
    expect(bound!.isDurationAllowed(DUR2)).toBe(true)
    expect(bound!.isDeliveryTypeAllowed(DELIVERY)).toBe(true)
    expect(bound!.isDeliveryTypeAllowed(DELIVERY2)).toBe(false)
    // And the bound functions agree with the standalone ones.
    expect(bound!.isServiceAllowed(SVC)).toBe(isServiceAllowed(filter, SVC))
    expect(bound!.isEmployeeAllowed(EMP)).toBe(isEmployeeAllowed(filter, EMP))
    expect(bound!.isDurationAllowed(DUR)).toBe(isDurationAllowed(filter, DUR))
    expect(bound!.isDeliveryTypeAllowed(DELIVERY)).toBe(
      isDeliveryTypeAllowed(filter, DELIVERY),
    )
  })
})
