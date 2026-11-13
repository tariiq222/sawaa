/**
 * Contract test for the dashboard service types (MNT-08).
 *
 * `lib/types/service.ts` derives every response shape from the committed
 * OpenAPI snapshot. These assertions run at type-check time
 * (`pnpm --filter dashboard typecheck`) and at test time, and fail when a
 * documented deviation stops being a deviation or when the wire shape moves
 * underneath the dashboard.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  CategoryListQuery,
  PractitionerDurationItem,
  Service,
  ServiceBookingType,
  ServiceCategory,
  ServiceDeliveryType,
  ServiceDurationOption,
  ServiceEmployee,
  ServiceEmployeeServiceType,
  ServiceListQuery,
} from "@/lib/types/service"
import type { CreateServicePayload, UpdateServicePayload } from "@/lib/types/service-payloads"

type Schemas = components["schemas"]
type ServiceWire = Schemas["ServiceDetailResponseDto"]
type ServiceListWire = Schemas["ServiceListItemResponseDto"]
type CategoryWire = Schemas["CategoryResponseDto"]
type CategoryListWire = Schemas["CategoryListItemResponseDto"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
/** Structural equivalence: identity is not preserved through Omit/intersection. */
type SameShape<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

/** Keys the dashboard owns (not part of the detail wire payload). */
type DashboardOwnedKeys = "employeeCount"

/** Every field the API sends exists on the dashboard type. */
type _CoversWireShape = Expect<Equal<Exclude<keyof ServiceWire, keyof Service>, never>>

/**
 * The only additions are the list-only `employeeCount` and the widened
 * `category` (a list row additionally carries its department row, and the
 * list/detail category shapes differ). Anything else is a deviation that must
 * be added to this list deliberately.
 */
type _AddsOnlyKnownKeys = Expect<Equal<Exclude<keyof Service, keyof ServiceWire>, DashboardOwnedKeys>>

/**
 * The list row adds exactly one key over the detail row. The `category` key is
 * shared but its TYPE is wider on a list row (its department is embedded), which
 * the category assertions below pin.
 */
type _ListAddsOnlyCounter = Expect<Equal<Exclude<keyof ServiceListWire, keyof ServiceWire>, "employeeCount">>
type _EmployeeCountIsInteger = Expect<Equal<ServiceListWire["employeeCount"], number>>
type _ServiceEmployeeCountIsOptional = Expect<Equal<Service["employeeCount"], number | undefined>>

/** Money is a decimal string on the wire, in integer halalas. */
type _PriceIsWireString = Expect<Equal<Service["price"], string>>
type _DepositIsWireString = Expect<Equal<Service["depositAmount"], string | null>>
type _BookingTypePriceIsWireString = Expect<Equal<ServiceBookingType["price"], string>>
type _DurationOptionPriceIsWireString = Expect<Equal<ServiceDurationOption["price"], string>>

/** The category embedded in a service is the category row, plus its department on lists. */
type _CategoryIsWire = Expect<SameShape<Exclude<Service["category"], null>, Omit<CategoryWire, never>>>
type _CategoryDepartmentIsListOnly = Expect<
  Equal<CategoryListWire["department"] extends ServiceCategory["department"] ? true : false, true>
>
type _CategoryCountIsListOnly = Expect<Equal<ServiceCategory["_count"], CategoryListWire["_count"] | undefined>>

/** Other response shapes are used as-is from the snapshot. */
type _ServiceEmployeeIsWire = Expect<
  SameShape<ServiceEmployee, Omit<Schemas["ServiceEmployeeAssignmentDto"], "effectiveDurations"> & {
    effectiveDurations: ServiceEmployee["effectiveDurations"]
  }>
>
type _ServiceTypeIsWire = Expect<SameShape<ServiceEmployeeServiceType, Schemas["ServiceEmployeeServiceTypeDto"]>>

/**
 * One documented narrowing: `resolveEffectiveDurations` stringifies the Prisma
 * `DeliveryType` column, so the snapshot says `string`; the value is always the
 * enum. Everything else about a duration row is the wire shape.
 */
type _DurationDeliveryTypeIsNarrowed = Expect<Equal<PractitionerDurationItem["deliveryType"], ServiceDeliveryType>>
type _DurationWireDeliveryTypeIsString = Expect<
  Equal<Schemas["EmployeeEffectiveDurationDto"]["deliveryType"], string>
>

/** The delivery vocabulary is the snapshot enum, not a local copy. */
type _DeliveryTypeIsWire = Expect<Equal<ServiceDeliveryType, Schemas["DeliveryType"]>>

/* ─── Request side: the local query/payload types must stay inside the contract ─── */

type ServicesQueryWire = NonNullable<
  paths["/api/v1/dashboard/organization/services"]["get"]["parameters"]["query"]
>
type CategoriesQueryWire = NonNullable<
  paths["/api/v1/dashboard/organization/categories"]["get"]["parameters"]["query"]
>
type CreateServiceBody = components["schemas"]["CreateServiceDto"]
type UpdateServiceBody = components["schemas"]["UpdateServiceDto"]

/** The dashboard query type is exactly the documented query surface. */
type _ServiceQueryCoversWire = Expect<Equal<Exclude<keyof ServicesQueryWire, keyof ServiceListQuery>, never>>
type _ServiceQueryAddsNothing = Expect<Equal<Exclude<keyof ServiceListQuery, keyof ServicesQueryWire>, never>>
type _CategoryQueryCoversWire = Expect<Equal<Exclude<keyof CategoriesQueryWire, keyof CategoryListQuery>, never>>
type _CategoryQueryAddsNothing = Expect<Equal<Exclude<keyof CategoryListQuery, keyof CategoriesQueryWire>, never>>

/** The hand-written write payloads never send a key the API does not accept. */
type _CreatePayloadFitsWire = Expect<Equal<Exclude<keyof CreateServicePayload, keyof CreateServiceBody>, never>>
type _UpdatePayloadFitsWire = Expect<Equal<Exclude<keyof UpdateServicePayload, keyof UpdateServiceBody>, never>>

/**
 * Dead hand-written fields. `IntakeForm`/`IntakeField` were declared here but
 * never imported from this module (intake forms use `lib/types/intake-form.ts`),
 * and the service endpoints never send `_count` on the service itself.
 */
type _NoDeadFields = Expect<
  Equal<Exclude<keyof Service, keyof ServiceWire | DashboardOwnedKeys>, never>
>

/** A representative list row type-checks into the dashboard entity. */
const wireRow: ServiceListWire = {
  id: "svc-1",
  ref: 1,
  categoryId: "cat-1",
  nameAr: "استشارة أسرية",
  nameEn: "Family consultation",
  descriptionAr: null,
  descriptionEn: null,
  durationMins: 60,
  price: "30000",
  currency: "SAR",
  imageUrl: null,
  isActive: true,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  iconName: null,
  iconBgColor: null,
  bufferMinutes: 0,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  depositEnabled: false,
  depositAmount: null,
  commissionRateOverride: null,
  durationOptions: [],
  category: null,
  employeeCount: 0,
}

const dashboardRow: Service = wireRow

describe("service type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(dashboardRow.employeeCount).toBe(0)
    expect(typeof dashboardRow.price).toBe("string")
    expect(dashboardRow.category).toBeNull()
    expect(dashboardRow.durationOptions).toEqual([])
  })
})
