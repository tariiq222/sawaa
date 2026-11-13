/**
 * Contract test for the dashboard employee types (MNT-08).
 *
 * `lib/types/employee.ts` derives every response shape from the committed
 * OpenAPI snapshot. These assertions run at type-check time
 * (`pnpm --filter dashboard typecheck`) and at test time, and fail when a
 * documented deviation stops being a deviation or when the wire shape moves
 * underneath the dashboard.
 */
import { describe, expect, it } from "vitest"
import type { components } from "@/lib/types/api.generated"
import type {
  AvailabilitySlot,
  BreakSlot,
  Employee,
  EmployeeDetail,
  EmployeeService,
  EmployeeServiceType,
  EmployeeStats,
  EmployeeUser,
  EmployeeWrite,
  OnboardEmployeeResponse,
  TimeSlot,
  Vacation,
} from "@/lib/types/employee"

type Schemas = components["schemas"]
type EmployeeWire = Schemas["EmployeeResponseDto"]
type EmployeeDetailWire = Schemas["EmployeeDetailResponseDto"]
type EmployeeServiceWire = Schemas["EmployeeAssignedServiceDto"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
/** Structural equivalence: identity is not preserved through Omit/intersection. */
type SameShape<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Expect<T extends true> = T

/** Keys the dashboard owns (not part of the wire payload). */
type DashboardOwnedKeys = "user"
/** Keys the dashboard narrows from the wire shape. */
type NarrowedKeys = "specialty"

/** Every field the API sends exists on the dashboard type. */
type _CoversWireShape = Expect<Equal<Exclude<keyof EmployeeWire, keyof Employee>, never>>

/**
 * The only additions are the synthetic `user` projection and the narrowed
 * `specialty`. If the backend grows a field or the mapper starts producing
 * another key, this stops compiling and the deviation list must be updated.
 */
type _AddsOnlyKnownKeys = Expect<Equal<Exclude<keyof Employee, keyof EmployeeWire>, DashboardOwnedKeys>>
type _NarrowsOnlyKnownKeys = Expect<Equal<Exclude<keyof Employee, keyof EmployeeWire>, DashboardOwnedKeys>>

/** Fields the dashboard intentionally reshapes. */
type _SpecialtyIsNarrowed = Expect<Equal<Employee["specialty"], string>>
type _WireSpecialtyIsNullable = Expect<Equal<EmployeeWire["specialty"], string | null>>
type _UserIsSynthetic = Expect<Equal<Employee["user"], EmployeeUser>>

/** Fields that stay exactly as the wire sends them. */
type _CountersAreWire = Expect<
  Equal<
    [Employee["averageRating"], Employee["ratingCount"], Employee["bookingCount"]],
    [number | null, number, number]
  >
>
type _AvailabilityIsWire = Expect<SameShape<Employee["availability"], EmployeeWire["availability"]>>
type _RefIsWire = Expect<Equal<Employee["ref"], number>>
type _EmploymentTypeIsWireVocabulary = Expect<
  Equal<Employee["employmentType"], "FULL_TIME" | "PART_TIME" | "CONTRACT">
>
type _OnboardingStatusIsWireVocabulary = Expect<
  Equal<Employee["onboardingStatus"], "PENDING" | "IN_PROGRESS" | "COMPLETED">
>

/** The detail shape is the list projection plus the wire exceptions. */
type _DetailCoversWire = Expect<Equal<Exclude<keyof EmployeeDetailWire, keyof EmployeeDetail>, never>>
type _DetailAddsKnownKeys = Expect<
  Equal<Exclude<keyof EmployeeDetail, keyof EmployeeWire>, DashboardOwnedKeys | "exceptions">
>
type _DetailSpecialtyIsNarrowed = Expect<Equal<EmployeeDetail["specialty"], string>>

/** Write responses are used as-is; they are the raw Prisma row, not the projection. */
type _WriteIsWire = Expect<SameShape<EmployeeWrite, Schemas["EmployeeWriteResponseDto"]>>
type _OnboardIsWire = Expect<SameShape<OnboardEmployeeResponse, Schemas["EmployeeOnboardResponseDto"]>>
type _StatsIsWire = Expect<SameShape<EmployeeStats, Schemas["EmployeeStatsResponseDto"]>>
/** The write row carries no rating/booking counters and no branch/service id arrays. */
type _WriteHasNoCounters = Expect<
  Equal<Extract<"averageRating" | "ratingCount" | "bookingCount" | "branchIds" | "serviceIds" | "isAcceptingBookings", keyof EmployeeWrite>, never>
>

/** Other response shapes are used as-is from the snapshot. */
type _ServiceIsWire = Expect<SameShape<EmployeeService, EmployeeServiceWire>>
type _ServiceTypeIsWire = Expect<SameShape<EmployeeServiceType, Schemas["EmployeeServiceTypeDto"]>>
type _VacationIsWire = Expect<SameShape<Vacation, Schemas["EmployeeAvailabilityExceptionRecordDto"]>>
type _SlotIsWire = Expect<SameShape<TimeSlot, Schemas["EmployeeSlotDto"]>>

/** Narrowed slices the editors consume. */
type _AvailabilitySlotKeys = Expect<
  Equal<keyof AvailabilitySlot, "dayOfWeek" | "startTime" | "endTime" | "isActive">
>
type _BreakSlotKeys = Expect<Equal<keyof BreakSlot, "id" | "dayOfWeek" | "startTime" | "endTime">>

/**
 * Dead hand-written fields. `_count`, `rating`, `reviewCount`, `priceClinic`,
 * `pricePhone` and `priceVideo` were on the old entity but no endpoint ever
 * sent them (`mapEmployeeRow` emits `bookingCount`/`ratingCount`, and
 * `EmployeeService` has no legacy per-type pricing). They must not come back.
 */
type _NoDeadFields = Expect<
  Equal<
    Exclude<
      keyof Employee,
      | keyof EmployeeWire
      | DashboardOwnedKeys
      | NarrowedKeys
    >,
    never
  >
>

/** A representative wire row type-checks, and maps into the dashboard entity. */
const wireRow: EmployeeWire = {
  id: "e1",
  ref: 1024,
  userId: null,
  name: "Dr. Khalid Al-Otaibi",
  nameAr: "خالد العتيبي",
  nameEn: "Khalid Al-Otaibi",
  title: "Senior Therapist",
  specialty: "Family Therapy",
  specialtyAr: "علاج أسري",
  gender: "MALE",
  bio: null,
  bioAr: null,
  education: null,
  educationAr: null,
  experience: 8,
  phone: "+966501234567",
  email: "khalid@example.com",
  avatarUrl: null,
  employmentType: "FULL_TIME",
  onboardingStatus: "COMPLETED",
  isActive: true,
  isAcceptingBookings: true,
  isPublic: false,
  slug: null,
  publicBioAr: null,
  publicBioEn: null,
  publicImageUrl: null,
  averageRating: 4.7,
  ratingCount: 32,
  bookingCount: 120,
  branchIds: ["br-1"],
  serviceIds: ["svc-1"],
  availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
}

/**
 * The documented narrowing applied at the API boundary (`mapEmployee`). If the
 * wire stops being nullable here, this stops compiling and the deviation list
 * in lib/types/employee.ts must be updated.
 */
const dashboardEmployee: Employee = {
  ...wireRow,
  specialty: wireRow.specialty ?? "",
  user: {
    id: wireRow.userId ?? wireRow.id,
    firstName: wireRow.name.split(" ")[0],
    lastName: wireRow.name.split(" ").slice(1).join(" "),
    email: wireRow.email ?? "",
    phone: wireRow.phone,
  },
}

describe("employee type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(dashboardEmployee.specialty).toBe("Family Therapy")
    expect(dashboardEmployee.user.firstName).toBe("Dr.")
    expect(dashboardEmployee.bookingCount).toBe(120)
    expect(dashboardEmployee.availability[0]?.dayOfWeek).toBe(1)
  })
})
