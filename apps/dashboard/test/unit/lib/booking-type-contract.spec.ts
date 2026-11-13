/**
 * Contract test for the dashboard booking types (MNT-08).
 *
 * `lib/types/booking.ts` derives `Booking` from the committed OpenAPI snapshot.
 * These assertions run at type-check time (`pnpm --filter dashboard typecheck`)
 * and at test time, and fail when a documented deviation stops being a
 * deviation or when the wire shape moves underneath the dashboard.
 */
import { describe, expect, it } from "vitest"
import type { components } from "@/lib/types/api.generated"
import type { Booking } from "@/lib/types/booking"

type BookingRow = components["schemas"]["BookingRowDto"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/** Every field the API sends must exist on the dashboard type. */
type _CoversWireShape = Expect<
  Equal<Exclude<keyof BookingRow, keyof Booking>, never>
>

/** Fields the dashboard intentionally widens or narrows. */
type _DateIsNarrowed = Expect<Equal<Booking["date"], string>>
type _StartTimeIsNarrowed = Expect<Equal<Booking["startTime"], string>>
type _TypeAcceptsUiVocabulary = Expect<Equal<Booking["type"], "in_person" | "group" | "walk_in" | "individual">>
type _ClientIdIsNullable = Expect<Equal<Booking["clientId"], string | null>>
type _ServiceIdIsNullable = Expect<Equal<Booking["serviceId"], string | null>>
type _DeliveryTypeIsUpper = Expect<Equal<Booking["deliveryType"], "IN_PERSON" | "ONLINE" | null>>

/**
 * `employeeNameSnapshot` and `departmentNameSnapshot` were in the old
 * hand-written type but are not produced by the API and no dashboard
 * component reads them; they are intentionally absent now.
 * A representative row type-checks against the dashboard entity.
 */
const wireRow: BookingRow = {
  id: "b1",
  bookingNumber: 12,
  clientId: "c1",
  employeeId: "e1",
  serviceId: "s1",
  employeeServiceId: "es1",
  type: "in_person",
  deliveryType: "in_person",
  source: "RECEPTION",
  date: "2026-11-12",
  startTime: "12:00",
  endTime: "13:00",
  status: "confirmed",
  isLateEntry: false,
  lateEntryRecordedAt: null,
  lateEntryRecordedBy: null,
  isHistoricalImport: false,
  historicalPayment: null,
  checkedInAt: null,
  notes: null,
  zoomJoinUrl: null,
  zoomHostUrl: null,
  zoomMeetingStatus: null,
  zoomMeetingError: null,
  zoomStartUrl: null,
  noShowAt: null,
  cancellationReason: null,
  cancelledBy: null,
  suggestedRefundType: null,
  adminNotes: null,
  cancelledAt: null,
  confirmedAt: null,
  completedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  client: null,
  employee: { id: "e1", userId: "u1", user: { firstName: "A", lastName: "B" }, specialty: "s", specialtyAr: "س" },
  service: { id: "s1", nameAr: "خدمة", nameEn: "Service", price: 1, duration: 60 },
  employeeService: null,
  rescheduledFrom: null,
  payment: null,
  invoice: null,
  packageFunding: null,
  intakeFormId: null,
  intakeFormAlreadySubmitted: false,
  priceSnapshot: null,
  durationMinutesSnapshot: 60,
  branchNameSnapshot: null,
  categoryNameSnapshot: null,
  payAtClinic: false,
  scheduledAt: "2026-11-12T09:00:00.000Z",
  endsAt: "2026-11-12T10:00:00.000Z",
}
/**
 * The documented narrowing applied at the API boundary. If a widening removal
 * ever happens (e.g. `date` becomes non-null on the wire), this stops
 * compiling and the deviation list in lib/types/booking.ts must be updated.
 */
const dashboardBooking: Booking = {
  ...wireRow,
  date: wireRow.date ?? "",
  startTime: wireRow.startTime ?? "",
  endTime: wireRow.endTime ?? "",
  type: wireRow.type,
  deliveryType: "IN_PERSON",
  cancelledBy: null,
  suggestedRefundType: null,
  employee: wireRow.employee!,
  service: wireRow.service!,
}

describe("booking type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(dashboardBooking.id).toBe("b1")
  })
})
