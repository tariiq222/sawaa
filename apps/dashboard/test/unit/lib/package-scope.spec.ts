import { describe, expect, it } from "vitest"
import {
  isSingleSpecificItem,
  itemToScopes,
  scopesToConstraints,
} from "@/lib/package-scope"
import type { PackageItemFormData } from "@/lib/schemas/package.schema"

const SVC = "svc-1"
const EMP = "emp-1"
const DUR = "dur-1"

const any = { mode: "ANY" as const, ids: [] }
const single = (id: string) => ({ mode: "INCLUDE" as const, ids: [id] })

const item = (over: Partial<PackageItemFormData> = {}): PackageItemFormData =>
  ({
    service: any,
    practitioner: any,
    duration: any,
    delivery: any,
    paidQuantity: 1,
    freeQuantity: 0,
    discountType: null,
    discountValue: 0,
    ...over,
  }) as PackageItemFormData

describe("isSingleSpecificItem", () => {
  it("is true only when service + practitioner + duration are single INCLUDE", () => {
    expect(
      isSingleSpecificItem({ service: single(SVC), practitioner: single(EMP), duration: single(DUR) }),
    ).toBe(true)
  })

  it("is false when any dimension is ANY", () => {
    expect(
      isSingleSpecificItem({ service: single(SVC), practitioner: any, duration: single(DUR) }),
    ).toBe(false)
  })

  it("is false when a dimension INCLUDEs more than one id", () => {
    expect(
      isSingleSpecificItem({
        service: { mode: "INCLUDE", ids: [SVC, "svc-2"] },
        practitioner: single(EMP),
        duration: single(DUR),
      }),
    ).toBe(false)
  })
})

describe("scopesToConstraints", () => {
  it("always emits SERVICE, PRACTITIONER and DURATION (single-specific)", () => {
    const c = scopesToConstraints(
      item({ service: single(SVC), practitioner: single(EMP), duration: single(DUR) }),
    )
    expect(c).toEqual([
      { dimension: "SERVICE", mode: "INCLUDE", targetIds: [SVC] },
      { dimension: "PRACTITIONER", mode: "INCLUDE", targetIds: [EMP] },
      { dimension: "DURATION", mode: "INCLUDE", targetIds: [DUR] },
    ])
  })

  it("forces DURATION to ANY when the item is not single-specific", () => {
    const c = scopesToConstraints(
      item({ service: single(SVC), practitioner: any, duration: single(DUR) }),
    )
    const dur = c.find((x) => x.dimension === "DURATION")
    expect(dur).toEqual({ dimension: "DURATION", mode: "ANY" })
  })

  it("emits DELIVERY_TYPE only when constrained", () => {
    const withDelivery = scopesToConstraints(item({ delivery: single("ONLINE") }))
    expect(withDelivery.some((x) => x.dimension === "DELIVERY_TYPE")).toBe(true)

    const withoutDelivery = scopesToConstraints(item({ delivery: any }))
    expect(withoutDelivery.some((x) => x.dimension === "DELIVERY_TYPE")).toBe(false)
  })

  it("passes EXCLUDE mode + ids through", () => {
    const c = scopesToConstraints(item({ practitioner: { mode: "EXCLUDE", ids: [EMP] } }))
    const prac = c.find((x) => x.dimension === "PRACTITIONER")
    expect(prac).toEqual({ dimension: "PRACTITIONER", mode: "EXCLUDE", targetIds: [EMP] })
  })
})

describe("itemToScopes", () => {
  it("maps response constraints back into scopes", () => {
    const scopes = itemToScopes({
      serviceId: null,
      employeeId: null,
      durationOptionId: null,
      constraints: [
        { dimension: "SERVICE", mode: "INCLUDE", targets: [{ targetId: SVC }] },
        { dimension: "PRACTITIONER", mode: "EXCLUDE", targets: [{ targetId: EMP }] },
        { dimension: "DELIVERY_TYPE", mode: "INCLUDE", targets: [{ targetId: "ONLINE" }] },
      ],
    })
    expect(scopes.service).toEqual({ mode: "INCLUDE", ids: [SVC] })
    expect(scopes.practitioner).toEqual({ mode: "EXCLUDE", ids: [EMP] })
    expect(scopes.duration).toEqual({ mode: "ANY", ids: [] })
    expect(scopes.delivery).toEqual({ mode: "INCLUDE", ids: ["ONLINE"] })
  })

  it("falls back to the legacy triple when constraints are absent", () => {
    const scopes = itemToScopes({
      serviceId: SVC,
      employeeId: EMP,
      durationOptionId: DUR,
    })
    expect(scopes.service).toEqual({ mode: "INCLUDE", ids: [SVC] })
    expect(scopes.practitioner).toEqual({ mode: "INCLUDE", ids: [EMP] })
    expect(scopes.duration).toEqual({ mode: "INCLUDE", ids: [DUR] })
    expect(scopes.delivery).toEqual({ mode: "ANY", ids: [] })
  })

  it("uses ANY for legacy triple fields that are null", () => {
    const scopes = itemToScopes({
      serviceId: SVC,
      employeeId: null,
      durationOptionId: null,
    })
    expect(scopes.service).toEqual({ mode: "INCLUDE", ids: [SVC] })
    expect(scopes.practitioner).toEqual({ mode: "ANY", ids: [] })
    expect(scopes.duration).toEqual({ mode: "ANY", ids: [] })
  })
})
