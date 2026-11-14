/**
 * Contract test for the dashboard program types (MNT-08).
 *
 * `lib/types/program.ts` derives every dashboard program response shape and the
 * create/update/schedule/cancel bodies from the committed OpenAPI snapshot.
 * These assertions run at type-check time (`pnpm --filter dashboard typecheck`)
 * and at test time, and fail when a documented deviation stops being a deviation
 * or when the wire shape moves underneath the dashboard.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  CancelProgramPayload,
  CreateProgramPayload,
  EnrollInProgramPayload,
  EnrollInProgramResult,
  ListProgramsQuery,
  ProgramCancellationPreview,
  ProgramCancellationResult,
  ProgramDetail,
  ProgramEnrollmentSummary,
  ProgramPublishResult,
  ProgramScheduleResult,
  ProgramStatus,
  ProgramSummary,
  ProgramWriteResult,
  PublicProgramListItem,
  ScheduleProgramPayload,
  UpdateProgramPayload,
} from "@/lib/types/program"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/* ─── Entities are the wire shapes, unchanged ─── */

type _SummaryIsWire = Expect<Equal<ProgramSummary, Schemas["ProgramListItemResponseDto"]>>
type _DetailIsWire = Expect<Equal<ProgramDetail, Schemas["ProgramDetailResponseDto"]>>
type _EnrollmentIsDetailRow = Expect<Equal<ProgramEnrollmentSummary, ProgramDetail["enrollments"][number]>>
type _PreviewIsWire = Expect<Equal<ProgramCancellationPreview, Schemas["ProgramCancellationPreviewDto"]>>
type _CancelResultIsWire = Expect<Equal<ProgramCancellationResult, Schemas["ProgramCancellationResultDto"]>>
type _WriteIsWire = Expect<Equal<ProgramWriteResult, Schemas["ProgramWriteResponseDto"]>>
type _PublishIsWire = Expect<Equal<ProgramPublishResult, Schemas["ProgramPublishResponseDto"]>>
type _ScheduleResultIsWire = Expect<Equal<ProgramScheduleResult, Schemas["ProgramScheduleResponseDto"]>>

/**
 * The two routes really are different shapes: the detail payload adds the
 * staff-facing descriptions, the supervisor rows and the enrollments, while the
 * list row is the only one carrying the joined `enrollmentCount`.
 */
type _DetailOnlyKeys = Expect<
  Equal<
    Exclude<keyof ProgramDetail, keyof ProgramSummary>,
    | "descriptionAr"
    | "descriptionEn"
    | "publicDescriptionAr"
    | "publicDescriptionEn"
    | "cancelReason"
    | "updatedAt"
    | "supervisors"
    | "enrollments"
  >
>
type _SummaryOnlyKeys = Expect<Equal<Exclude<keyof ProgramSummary, keyof ProgramDetail>, "enrollmentCount">>

/** The lifecycle vocabulary is the snapshot enum, not a local copy. */
type _StatusIsWire = Expect<Equal<ProgramStatus, Schemas["ProgramListItemResponseDto"]["status"]>>
type _StatusValues = Expect<
  Equal<ProgramStatus, "DRAFT" | "OPEN" | "MIN_REACHED" | "SCHEDULED" | "COMPLETED" | "CANCELLED">
>

/* ─── Money and integer discipline ─── */

/** Prisma Decimal columns are serialized with `.toString()` — never numbers. */
type _PriceIsWireString = Expect<Equal<ProgramSummary["price"], string>>
type _DepositIsWireString = Expect<Equal<ProgramSummary["depositAmount"], string | null>>
type _DetailPriceIsWireString = Expect<Equal<ProgramDetail["price"], string>>
type _EnrollmentBookingPriceIsString = Expect<Equal<ProgramEnrollmentSummary["booking"]["price"], string>>

/** Integer-valued columns are numbers on the wire. */
type _CountsAreNumbers = Expect<
  Equal<
    Pick<
      ProgramSummary,
      "ref" | "daysCount" | "hoursPerDay" | "minParticipants" | "maxParticipants" | "enrolledCount" | "enrollmentCount"
    >,
    {
      ref: number
      daysCount: number
      hoursPerDay: number
      minParticipants: number
      maxParticipants: number
      enrolledCount: number
      enrollmentCount: number
    }
  >
>

/** The write payload is identity + state only — it never echoes the whole row. */
type _WriteKeys = Expect<Equal<keyof ProgramWriteResult, "id" | "ref" | "status" | "supervisorIds">>
type _PublishKeys = Expect<Equal<keyof ProgramPublishResult, "id" | "status">>
type _ScheduleKeys = Expect<Equal<keyof ProgramScheduleResult, "id" | "status" | "startDate">>

/* ─── Request side: the local query/payload types must stay inside the contract ─── */

type ProgramsQueryWire = NonNullable<
  paths["/api/v1/dashboard/programs"]["get"]["parameters"]["query"]
>
type CreateProgramBody = Schemas["CreateProgramDto"]
type UpdateProgramBody = Schemas["UpdateProgramDto"]

/** The dashboard query type is exactly the documented query surface. */
type _QueryCoversWire = Expect<Equal<Exclude<keyof ProgramsQueryWire, keyof ListProgramsQuery>, never>>
type _QueryAddsNothing = Expect<Equal<Exclude<keyof ListProgramsQuery, keyof ProgramsQueryWire>, never>>

/**
 * The hand-written payloads never send a key the API does not accept. The one
 * allowed difference is on the create body: `currency`, `depositEnabled` and
 * `isPublic` are documented with defaults, which openapi-typescript renders as
 * required, while the dashboard form may omit them and let the server apply the
 * same defaults. Compare the key sets, and the types of the relaxed keys.
 */
type _CreatePayloadHasExactlyTheWireKeys = Expect<
  Equal<keyof CreateProgramPayload, keyof CreateProgramBody>
>
type _CreatePayloadRelaxedKeys = Expect<
  Equal<
    Pick<CreateProgramPayload, "currency" | "depositEnabled" | "isPublic">,
    { currency?: string; depositEnabled?: boolean; isPublic?: boolean }
  >
>
type _UpdatePayloadIsWire = Expect<Equal<UpdateProgramPayload, UpdateProgramBody>>
type _SchedulePayloadIsWire = Expect<Equal<ScheduleProgramPayload, Schemas["ScheduleProgramDto"]>>
type _CancelPayloadIsWire = Expect<Equal<CancelProgramPayload, Schemas["CancelProgramDto"]>>

/**
 * `refunds` only exists after the start date; its amount is integer halalas and
 * the shape is the documented participant refund row, not a local copy.
 */
type _CancelRefundItem = Expect<
  Equal<NonNullable<CancelProgramPayload["refunds"]>[number], Schemas["ProgramParticipantRefundDto"]>
>
type _CancelRefundAmountIsInteger = Expect<Equal<Schemas["ProgramParticipantRefundDto"]["amount"], number>>

/**
 * The enrollment route and the public listing have no response schema in the
 * snapshot yet, so those two shapes stay local. This pins the fields the
 * dashboard actually reads so they cannot silently grow.
 */
type _EnrollResultKeys = Expect<Equal<keyof EnrollInProgramResult, "type" | "bookingId" | "status" | "invoiceId">>
type _EnrollPayloadKeys = Expect<Equal<keyof EnrollInProgramPayload, "programId" | "clientId">>
type _PublicListKeepsItsLocalKeys = Expect<
  Equal<
    Extract<keyof PublicProgramListItem, "isOpenForEnrollment" | "descriptionAr" | "publicDescriptionEn">,
    "isOpenForEnrollment" | "descriptionAr" | "publicDescriptionEn"
  >
>
type _PublicListFlagIsLocal = Expect<
  Equal<PublicProgramListItem["isOpenForEnrollment"], boolean | undefined>
>
/** The flagged local shape is not the dashboard list row: it has no `enrollmentCount`. */
type _PublicListHasNoDashboardCounter = Expect<
  Equal<"enrollmentCount" extends keyof PublicProgramListItem ? true : false, false>
>

/* ─── Runtime smoke: the types line up with a real wire row ─── */

const wireRow: Schemas["ProgramListItemResponseDto"] = {
  id: "00000000-4000-4000-a000-0000000000aa",
  ref: 24,
  nameAr: "برنامج التواصل الأسري",
  nameEn: null,
  departmentId: "00000000-0000-4000-a000-000000000001",
  branchId: "00000000-0000-4000-a000-000000000002",
  startDate: null,
  daysCount: 3,
  hoursPerDay: 2,
  minParticipants: 3,
  maxParticipants: 12,
  enrolledCount: 1,
  price: "150000",
  currency: "SAR",
  depositEnabled: false,
  depositAmount: null,
  status: "OPEN",
  isPublic: true,
  cancelledAt: null,
  createdAt: "2026-10-10T09:00:00.000Z",
  supervisorIds: ["00000000-0000-4000-a000-000000000003"],
  isFull: false,
  enrollmentCount: 1,
}

const dashboardRow: ProgramSummary = wireRow

describe("program type contract", () => {
  it("keeps the dashboard entity aligned with the OpenAPI snapshot", () => {
    expect(dashboardRow.price).toBe("150000")
    expect(dashboardRow.enrollmentCount).toBe(1)
    expect(dashboardRow.status).toBe("OPEN")
    expect(dashboardRow.depositAmount).toBeNull()
  })

  it("documents money as decimal strings and counts as numbers", () => {
    expect(typeof dashboardRow.price).toBe("string")
    expect(typeof dashboardRow.enrolledCount).toBe("number")
    expect(typeof dashboardRow.isFull).toBe("boolean")
  })
})
