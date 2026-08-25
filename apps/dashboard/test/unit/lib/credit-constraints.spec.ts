import { describe, expect, it } from "vitest"
import {
  allowedTargets,
  blockedTargets,
  creditStillViable,
  effectiveConstraints,
  filterByConstraint,
  isAllowedOnDimension,
  isFlexibleCredit,
  specificityScore,
} from "@/lib/credit-constraints"
import type {
  MatchableCredit,
  PartialBookingTarget,
} from "@/lib/credit-constraints"
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
const DELIVERY = "ONLINE"

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

const credit = (over: Partial<MatchableCredit> = {}): MatchableCredit => ({
  constraints: [],
  serviceId: null,
  employeeId: null,
  durationOptionId: null,
  ...over,
})

describe("effectiveConstraints", () => {
  it("returns snapshot rows verbatim when present", () => {
    const snapshot: PackageCreditConstraint[] = [
      inc("SERVICE", [SVC]),
      exc("PRACTITIONER", [EMP]),
      any("DURATION"),
    ]
    expect(effectiveConstraints(credit({ constraints: snapshot }))).toBe(snapshot)
  })

  it("synthesises three INCLUDE rows from a full legacy triple when constraints are empty", () => {
    const eff = effectiveConstraints(
      credit({ serviceId: SVC, employeeId: EMP, durationOptionId: DUR }),
    )
    expect(eff).toEqual([
      { dimension: "SERVICE", mode: "INCLUDE", targetIds: [SVC] },
      { dimension: "PRACTITIONER", mode: "INCLUDE", targetIds: [EMP] },
      { dimension: "DURATION", mode: "INCLUDE", targetIds: [DUR] },
    ])
  })

  it("skips null members of the legacy triple (only SERVICE set → one row)", () => {
    expect(effectiveConstraints(credit({ serviceId: SVC }))).toEqual([
      { dimension: "SERVICE", mode: "INCLUDE", targetIds: [SVC] },
    ])
  })

  it("returns [] when constraints are empty and the legacy triple is fully null", () => {
    expect(effectiveConstraints(credit())).toEqual([])
  })
})

describe("isFlexibleCredit", () => {
  it("is true when serviceId is null", () => {
    expect(isFlexibleCredit(credit({ serviceId: null }))).toBe(true)
  })

  it("is false when serviceId is set", () => {
    expect(isFlexibleCredit(credit({ serviceId: SVC }))).toBe(false)
  })
})

describe("allowedTargets", () => {
  it("returns a Set of listed ids for INCLUDE", () => {
    const allowed = allowedTargets(
      credit({ constraints: [inc("SERVICE", [SVC, SVC2])] }),
      "SERVICE",
    )
    expect(allowed).toBeInstanceOf(Set)
    expect(allowed?.has(SVC)).toBe(true)
    expect(allowed?.has(SVC2)).toBe(true)
    expect(allowed?.has(EMP)).toBe(false)
  })

  it("returns null when the dimension row is ANY", () => {
    expect(
      allowedTargets(credit({ constraints: [any("SERVICE")] }), "SERVICE"),
    ).toBeNull()
  })

  it("returns null when the dimension has no row at all", () => {
    expect(
      allowedTargets(credit({ constraints: [inc("SERVICE", [SVC])] }), "DURATION"),
    ).toBeNull()
  })

  it("returns null when the only row is EXCLUDE", () => {
    expect(
      allowedTargets(credit({ constraints: [exc("SERVICE", [SVC])] }), "SERVICE"),
    ).toBeNull()
  })
})

describe("blockedTargets", () => {
  it("returns a Set of EXCLUDE ids for the dimension", () => {
    const blocked = blockedTargets(
      credit({ constraints: [exc("PRACTITIONER", [EMP, EMP2])] }),
      "PRACTITIONER",
    )
    expect(blocked).toBeInstanceOf(Set)
    expect(blocked?.has(EMP)).toBe(true)
    expect(blocked?.has(EMP2)).toBe(true)
  })

  it("returns null when no EXCLUDE row applies", () => {
    expect(
      blockedTargets(credit({ constraints: [inc("PRACTITIONER", [EMP])] }), "PRACTITIONER"),
    ).toBeNull()
    expect(
      blockedTargets(credit({ constraints: [any("PRACTITIONER")] }), "PRACTITIONER"),
    ).toBeNull()
  })
})

describe("isAllowedOnDimension", () => {
  it("ANY passes even with a null id", () => {
    expect(
      isAllowedOnDimension(credit({ constraints: [any("SERVICE")] }), "SERVICE", null),
    ).toBe(true)
  })

  it("INCLUDE fails with a null id", () => {
    expect(
      isAllowedOnDimension(credit({ constraints: [inc("SERVICE", [SVC])] }), "SERVICE", null),
    ).toBe(false)
  })

  it("INCLUDE passes only for listed ids", () => {
    const cred = credit({ constraints: [inc("SERVICE", [SVC])] })
    expect(isAllowedOnDimension(cred, "SERVICE", SVC)).toBe(true)
    expect(isAllowedOnDimension(cred, "SERVICE", SVC2)).toBe(false)
  })

  it("EXCLUDE passes for unlisted ids and fails for listed ones", () => {
    const cred = credit({ constraints: [exc("SERVICE", [SVC])] })
    expect(isAllowedOnDimension(cred, "SERVICE", SVC2)).toBe(true)
    expect(isAllowedOnDimension(cred, "SERVICE", SVC)).toBe(false)
  })

  it("a dimension with no row passes for any id including null", () => {
    const cred = credit()
    expect(isAllowedOnDimension(cred, "SERVICE", SVC)).toBe(true)
    expect(isAllowedOnDimension(cred, "SERVICE", null)).toBe(true)
    expect(isAllowedOnDimension(cred, "SERVICE", undefined)).toBe(true)
  })
})

describe("multiple rows on one dimension apply conjunctively", () => {
  it("rejects an id that passes INCLUDE but hits EXCLUDE", () => {
    const cred = credit({
      constraints: [inc("SERVICE", [SVC, SVC2]), exc("SERVICE", [SVC])],
    })
    // SVC is in INCLUDE but also in EXCLUDE → blocked.
    expect(isAllowedOnDimension(cred, "SERVICE", SVC)).toBe(false)
    // SVC2 is in INCLUDE and not in EXCLUDE → allowed.
    expect(isAllowedOnDimension(cred, "SERVICE", SVC2)).toBe(true)
  })

  it("intersects multiple INCLUDE rows on the same dimension", () => {
    const cred = credit({
      constraints: [
        inc("SERVICE", [SVC, SVC2, "svc-3"]),
        inc("SERVICE", [SVC2, "svc-3"]),
      ],
    })
    expect(allowedTargets(cred, "SERVICE")).toEqual(new Set([SVC2, "svc-3"]))
  })
})

describe("filterByConstraint", () => {
  const services = [{ id: "svc-a" }, { id: "svc-b" }, { id: "svc-c" }]
  const getId = (s: { id: string }) => s.id

  it("returns the list unchanged for an unrestricted dimension", () => {
    const out = filterByConstraint(credit(), "SERVICE", services, getId)
    expect(out).toEqual(services)
    expect(out).not.toBe(services) // shallow copy, not the same reference
  })

  it("narrows to listed ids for INCLUDE", () => {
    const out = filterByConstraint(
      credit({ constraints: [inc("SERVICE", ["svc-a", "svc-c"])] }),
      "SERVICE",
      services,
      getId,
    )
    expect(out.map((s) => s.id)).toEqual(["svc-a", "svc-c"])
  })

  it("removes blocked ids for EXCLUDE", () => {
    const out = filterByConstraint(
      credit({ constraints: [exc("SERVICE", ["svc-b"])] }),
      "SERVICE",
      services,
      getId,
    )
    expect(out.map((s) => s.id)).toEqual(["svc-a", "svc-c"])
  })

  it("returns [] when nothing qualifies", () => {
    const out = filterByConstraint(
      credit({ constraints: [inc("SERVICE", ["svc-nonexistent"])] }),
      "SERVICE",
      services,
      getId,
    )
    expect(out).toEqual([])
  })
})

describe("creditStillViable", () => {
  const baseCredit = credit({
    constraints: [
      inc("SERVICE", [SVC]),
      inc("PRACTITIONER", [EMP]),
      inc("DURATION", [DUR]),
    ],
  })

  it("returns true for a fully undecided target", () => {
    expect(creditStillViable(baseCredit, {})).toBe(true)
  })

  it("returns true for a partially-filled compliant target", () => {
    const t: PartialBookingTarget = { serviceId: SVC }
    expect(creditStillViable(baseCredit, t)).toBe(true)
  })

  it("returns false as soon as a decided value violates a rule", () => {
    const t: PartialBookingTarget = { serviceId: SVC2 } // not in INCLUDE list
    expect(creditStillViable(baseCredit, t)).toBe(false)
  })

  it("applies EXCLUDE rules as soon as the dimension is decided", () => {
    const cred = credit({
      constraints: [exc("DELIVERY_TYPE", [DELIVERY])],
    })
    expect(creditStillViable(cred, { deliveryType: DELIVERY })).toBe(false)
    expect(creditStillViable(cred, { deliveryType: "IN_PERSON" })).toBe(true)
    expect(creditStillViable(cred, {})).toBe(true) // undecided → tolerated
  })
})

describe("specificityScore", () => {
  it("counts non-ANY rows", () => {
    const cred = credit({
      constraints: [
        inc("SERVICE", [SVC]),
        any("PRACTITIONER"),
        exc("DURATION", ["dur-x"]),
      ],
    })
    expect(specificityScore(cred)).toBe(2)
  })

  it("scores a legacy triple credit as 3", () => {
    expect(
      specificityScore(
        credit({ serviceId: SVC, employeeId: EMP, durationOptionId: DUR }),
      ),
    ).toBe(3)
  })

  it("returns 0 for a fully empty credit", () => {
    expect(specificityScore(credit())).toBe(0)
  })
})
