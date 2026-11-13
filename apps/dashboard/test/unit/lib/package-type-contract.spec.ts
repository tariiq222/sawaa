/**
 * Contract test for the dashboard package types (MNT-08).
 *
 * `lib/types/package.ts` derives every response shape from the committed
 * OpenAPI snapshot. These assertions run at type-check time
 * (`pnpm --filter dashboard typecheck`) and at test time, and fail when the
 * wire shape moves underneath the dashboard.
 *
 * The endpoints deliberately return three different shapes for the same
 * catalog entry:
 *  - GET list rows carry the computed price flattened (`subtotal`,
 *    `discountAmount`, `finalPrice`, `fullValue`, `freeValue`, `vatRate`);
 *  - GET detail carries the same decorated package plus a nested `price`
 *    breakdown;
 *  - POST / PATCH return the RAW persisted row (legacy `items`, or grouped
 *    `groups`) and no computed price.
 */
import { describe, expect, it } from "vitest"
import type { components } from "@/lib/types/api.generated"
import type {
  CreatePackageItemPayload,
  PackageConstraintInput,
  PackageConstraintMode,
  PackageDiscountType,
  PackageEditorEntity,
  PackagePriceBreakdown,
  PackageWriteResponse,
  SessionPackage,
  SessionPackageDetail,
} from "@/lib/types/package"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type SameShape<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

/* ─── Entities are the wire shapes, unchanged ─── */

type _ListRowIsWire = Expect<Equal<SessionPackage, Schemas["PackageListRowDto"]>>
type _DetailIsWire = Expect<Equal<SessionPackageDetail, Schemas["PackageDetailResponseDto"]>>
type _WriteIsWire = Expect<
  SameShape<
    PackageWriteResponse,
    Schemas["PackageLegacyWriteResponseDto"] | Schemas["PackageGroupedWriteResponseDto"]
  >
>

/**
 * The detail response is the decorated package plus the nested price. The
 * extra price columns only exist on the list row, so a detail payload must
 * not be passed where a list row is expected (and vice versa).
 */
type _DetailCoversList = Expect<Equal<Exclude<keyof SessionPackageDetail, keyof SessionPackage>, "price">>
type _ListAddsPriceColumns = Expect<
  Equal<
    Exclude<keyof SessionPackage, keyof SessionPackageDetail>,
    "subtotal" | "discountAmount" | "finalPrice" | "fullValue" | "freeValue" | "vatRate"
  >
>
/** The raw write row never carries the computed price. */
type _WriteHasNoComputedPrice = Expect<
  Equal<
    Extract<
      "subtotal" | "discountAmount" | "finalPrice" | "fullValue" | "freeValue" | "vatRate" | "price" | "groups",
      keyof Schemas["PackageLegacyWriteResponseDto"]
    >,
    never
  >
>

/** Editor entity = list row minus the price columns the editors never read. */
type _EditorDropsPriceColumns = Expect<
  Equal<
    Exclude<keyof SessionPackage, keyof PackageEditorEntity>,
    "subtotal" | "discountAmount" | "finalPrice" | "fullValue" | "freeValue" | "vatRate"
  >
>

/* ─── Money and enum vocabulary ─── */

/** Item discount type is the persisted Prisma enum as the API sends it. */
type _DiscountTypeIsWire = Expect<Equal<PackageDiscountType, "PERCENTAGE" | "FIXED">>
type _ConstraintModeIsWire = Expect<Equal<PackageConstraintMode, "ANY" | "INCLUDE" | "EXCLUDE">>
type _ModelVersionIsWire = Expect<Equal<SessionPackage["modelVersion"], "LEGACY" | "GROUPED_V2">>
type _DeliveryTypeIsWire = Expect<
  Equal<Schemas["PackageGroupSessionReadDto"]["deliveryType"], "IN_PERSON" | "ONLINE">
>

/** Integer halalas stay numbers; Prisma Decimals stay decimal strings. */
type _MoneyIsInteger = Expect<
  Equal<
    [SessionPackage["subtotal"], SessionPackage["finalPrice"], SessionPackage["discountAmount"]],
    [number, number, number]
  >
>
type _DecimalColumnsAreStrings = Expect<
  Equal<[SessionPackage["discountValue"], SessionPackage["items"][number]["discountValue"]], [string, string]>
>
type _UnitPriceIsNullableString = Expect<
  Equal<SessionPackage["items"][number]["unitPrice"], string | null>
>
type _VatRateIsFraction = Expect<Equal<SessionPackage["vatRate"], number>>

/** The write payload can express "no per-item discount" as null (handler contract). */
type _ItemPayloadAllowsNullDiscount = Expect<
  Equal<CreatePackageItemPayload["discountType"], PackageDiscountType | null | undefined>
>
type _ConstraintInputIsWire = Expect<
  SameShape<PackageConstraintInput, Schemas["PackageConstraintInputDto"]>
>

/**
 * The client-side price preview is a pure mirror of the backend math and is
 * NOT a wire type: it adds `totalSavings`, which no endpoint sends.
 */
type _PreviewAddsSavings = Expect<Equal<Extract<"totalSavings", keyof PackagePriceBreakdown>, "totalSavings">>
type _WireHasNoSavings = Expect<
  Equal<Extract<"totalSavings", keyof Schemas["PackagePriceBreakdownDto"]>, never>
>

/* ─── Runtime samples ─── */

const wireRow: SessionPackage = {
  id: "pkg-1",
  familyId: null,
  ownerEmployeeId: null,
  modelVersion: "GROUPED_V2",
  nameAr: "باقة",
  nameEn: "Pack",
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  discountType: "PERCENTAGE",
  discountValue: "10",
  isActive: true,
  isPublic: false,
  sortOrder: 0,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [],
  groups: [
    {
      key: "group-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      sequenceMode: "ORDERED",
      dependsOnGroupKey: null,
      sessions: [
        { key: "s1", position: 0, durationOptionId: "dur-1", deliveryType: "ONLINE", unitPrice: 30000 },
      ],
    },
  ],
  globalDiscount: { type: "NONE", value: 0 },
  subtotal: 30000,
  discountAmount: 0,
  finalPrice: 30000,
  fullValue: 30000,
  freeValue: 0,
  vatRate: 0.15,
}

const wireDetail: SessionPackageDetail = {
  id: wireRow.id,
  familyId: wireRow.familyId,
  ownerEmployeeId: wireRow.ownerEmployeeId,
  modelVersion: wireRow.modelVersion,
  nameAr: wireRow.nameAr,
  nameEn: wireRow.nameEn,
  descriptionAr: wireRow.descriptionAr,
  descriptionEn: wireRow.descriptionEn,
  imageUrl: wireRow.imageUrl,
  iconName: wireRow.iconName,
  iconBgColor: wireRow.iconBgColor,
  discountType: wireRow.discountType,
  discountValue: wireRow.discountValue,
  isActive: wireRow.isActive,
  isPublic: wireRow.isPublic,
  sortOrder: wireRow.sortOrder,
  archivedAt: wireRow.archivedAt,
  createdAt: wireRow.createdAt,
  updatedAt: wireRow.updatedAt,
  items: wireRow.items,
  groups: wireRow.groups,
  globalDiscount: wireRow.globalDiscount,
  price: {
    subtotal: 30000,
    discountAmount: 0,
    finalPrice: 30000,
    fullValue: 30000,
    freeValue: 0,
    itemUnitPrices: [{ durationOptionId: "dur-1", unitPrice: 30000 }],
    lines: [
      {
        durationOptionId: "dur-1",
        unitPrice: 30000,
        fullValue: 30000,
        freeValue: 0,
        payable: 30000,
        discountAmount: 0,
        net: 30000,
      },
    ],
  },
}

describe("package type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(wireRow.groups[0].sessions[0].unitPrice).toBe(30000)
    expect(wireRow.vatRate).toBe(0.15)
    expect(Number(wireRow.discountValue)).toBe(10)
    // The detail response quotes the price as a nested breakdown.
    expect(wireDetail.price.finalPrice).toBe(30000)
    expect("subtotal" in wireDetail).toBe(false)
  })
})
