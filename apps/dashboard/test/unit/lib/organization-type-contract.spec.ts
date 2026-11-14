/**
 * Contract test for the dashboard organization types (MNT-08).
 *
 * `lib/types/branch.ts`, `lib/types/department.ts`,
 * `lib/types/organization-settings.ts` and `lib/api/booking-settings.ts` derive
 * every response shape from the committed OpenAPI snapshot. These assertions
 * run at type-check time (`pnpm --filter dashboard typecheck`) and at test time,
 * and fail when the wire shape moves underneath the dashboard — or when a
 * documented deviation stops being a deviation.
 */
import { describe, expect, it } from "vitest"
import type { components } from "@/lib/types/api.generated"
import type { Branch } from "@/lib/types/branch"
import type { Department } from "@/lib/types/department"
import type { OrganizationSettings } from "@/lib/types/organization-settings"
import type { BookingSettings } from "@/lib/api/booking-settings"
import type { PaymentSettings } from "@/lib/api/organization-settings"
import type { OrganizationHour, OrganizationHoliday } from "@/lib/api/organization"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/* ─── Branches ─── */

/**
 * The dashboard deliberately does not map four wire fields (`toBranch` never
 * returned them and nothing reads them); every other field the API sends is on
 * the type.
 */
type _BranchDropsOnlyUnreadFields = Expect<
  Equal<Exclude<keyof Schemas["BranchResponseDto"], keyof Branch>, "city" | "country" | "latitude" | "longitude">
>
/** The only other deviation is `nameEn`, normalised from `string | null` to `string`. */
type _BranchAddsNothing = Expect<Equal<Exclude<keyof Branch, keyof Schemas["BranchResponseDto"]>, never>>
type _BranchNameEnIsNormalised = Expect<Equal<Branch["nameEn"], string>>
type _WireNameEnIsNullable = Expect<Equal<Schemas["BranchResponseDto"]["nameEn"], string | null>>
/** GET detail adds exactly its two relations to the row; the dashboard reads it
 *  through `BranchDetailResponseDto` only on the branches API surface. */
type _BranchDetailAddsRelations = Expect<
  Equal<Exclude<keyof Schemas["BranchDetailResponseDto"], keyof Schemas["BranchResponseDto"]>, "businessHours" | "holidays">
>

/** A branch employee entry documents the employee summary, not a bare link. */
type _BranchEmployeeHasSummary = Expect<
  Equal<keyof Schemas["BranchEmployeeListEntryResponseDto"]["employee"], "id" | "isActive" | "specialty" | "specialtyAr" | "name" | "nameEn" | "email">
>

/* ─── Departments ─── */

type _DepartmentCoversWire = Expect<
  Equal<Exclude<keyof Schemas["DepartmentResponseDto"], keyof Department>, never>
>
/** `_count` is gone for good: no department endpoint ever sent it. */
type _DepartmentHasNoCount = Expect<Equal<Extract<"_count", keyof Department>, never>>
type _DepartmentNameEnIsNormalised = Expect<Equal<Department["nameEn"], string>>
/** List-only members stay optional so detail/create/update payloads fit. */
type _DepartmentListFieldsOptional = Expect<
  Equal<[Department["categories"], Department["bookableCategoriesCount"]], [Schemas["DepartmentListItemResponseDto"]["categories"] | undefined, number | undefined]>
>
type _DepartmentListFieldIsWire = Expect<
  Equal<NonNullable<Department["categories"]>, Schemas["DepartmentListItemResponseDto"]["categories"]>
>

/* ─── Organization settings ─── */

type _SettingsIsWire = Expect<Equal<OrganizationSettings, Schemas["OrganizationSettingsResponseDto"]>>
/** Prisma Decimal → decimal string; the forms coerce it, they must not assume number. */
type _VatRateIsString = Expect<Equal<OrganizationSettings["vatRate"], string>>
type _BankAccountsAreWire = Expect<
  Equal<OrganizationSettings["bankTransferAccounts"], Schemas["BankTransferAccountResponseDto"][]>
>
/** `socialMedia` is a free-form JSON column. */
type _SocialMediaIsJson = Expect<Equal<OrganizationSettings["socialMedia"], { [key: string]: unknown } | null>>
type _CustomDomainGraceIsNullableDate = Expect<Equal<OrganizationSettings["customDomainGraceUntil"], string | null>>

/* ─── Booking settings ─── */

/** The values are always present, on both documented GET shapes. */
type _BookingValuesAreWire = Expect<Equal<BookingSettings["bufferMinutes"], number>>
type _BookingEnumsAreWire = Expect<
  Equal<[BookingSettings["freeCancelRefundType"], BookingSettings["clientCancelCutoffMode"]], [Schemas["RefundType"], Schemas["ClientCancelCutoffMode"] | null]>
>
/** Row identity is absent when the handler answers the built-in defaults. */
type _BookingIdentityIsOptional = Expect<
  Equal<[BookingSettings["id"], BookingSettings["branchId"]], [string | undefined, string | null | undefined]>
>

/* ─── Payment settings ─── */

type _PaymentFlagsAreBoolean = Expect<
  Equal<
    [
      PaymentSettings["paymentMoyasarEnabled"],
      PaymentSettings["paymentAtClinicEnabled"],
      PaymentSettings["payMethodCashEnabled"],
    ],
    [boolean, boolean, boolean]
  >
>
/** The bank-transfer pair stays optional, matching every existing read site. */
type _PaymentBankFieldsOptional = Expect<
  Equal<[PaymentSettings["paymentBankTransferEnabled"], PaymentSettings["bankTransferAccounts"]], [boolean | undefined, Schemas["BankTransferAccountResponseDto"][] | undefined]>
>

/* ─── Working hours ─── */

/** A holiday is mapped to the same five fields it has always exposed. */
type _HolidayDropsBranchId = Expect<
  Equal<Exclude<keyof Schemas["HolidayRecordDto"], keyof OrganizationHoliday>, "branchId">
>
type _HolidayAddsNothing = Expect<Equal<Exclude<keyof OrganizationHoliday, keyof Schemas["HolidayRecordDto"]>, never>>

/** The grid keeps its own `isActive` vocabulary; the wire field is `isOpen`. */
type _HourKeepsGridVocabulary = Expect<Equal<[OrganizationHour["isActive"], "isOpen" extends keyof OrganizationHour ? true : false], [boolean, false]>>
type _WireUsesIsOpen = Expect<Equal<Schemas["OrganizationHoursRecordDto"]["isOpen"], boolean>>

/* ─── Runtime samples ─── */

const wireBranch: Branch = {
  id: "branch-1",
  nameAr: "الفرع الرئيسي",
  nameEn: "",
  phone: "+966500000000",
  addressAr: "الرياض",
  addressEn: null,
  isActive: true,
  isMain: true,
  timezone: "Asia/Riyadh",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
}

const wireDepartment: Department = {
  id: "dept-1",
  nameAr: "قسم",
  nameEn: "",
  descriptionAr: null,
  descriptionEn: null,
  icon: null,
  isVisible: true,
  sortOrder: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  categories: [
    {
      id: "cat-1",
      ref: 101,
      departmentId: "dept-1",
      nameAr: "فئة",
      nameEn: null,
      sortOrder: 0,
      isActive: true,
      bookingMode: "SERVICES",
      kind: "CLINIC",
      imageUrl: null,
      iconName: null,
      iconBgColor: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  bookableCategoriesCount: 0,
}

const wireSettings: OrganizationSettings = {
  id: "settings-1",
  companyNameAr: null,
  companyNameEn: null,
  productTagline: null,
  businessRegistration: null,
  vatRegistrationNumber: null,
  vatRate: "0.15",
  sellerAddress: null,
  organizationCity: "Riyadh",
  postalCode: null,
  contactPhone: null,
  contactEmail: null,
  address: null,
  socialMedia: null,
  aboutAr: null,
  aboutEn: null,
  privacyPolicyAr: null,
  privacyPolicyEn: null,
  termsAr: null,
  termsEn: null,
  cancellationPolicyAr: null,
  cancellationPolicyEn: null,
  defaultLanguage: "ar",
  timezone: "Asia/Riyadh",
  weekStartDay: "sunday",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "12h",
  emailHeaderShowLogo: true,
  emailHeaderShowName: true,
  emailFooterPhone: null,
  emailFooterWebsite: null,
  emailFooterInstagram: null,
  emailFooterTwitter: null,
  emailFooterSnapchat: null,
  emailFooterTiktok: null,
  emailFooterLinkedin: null,
  emailFooterYoutube: null,
  sessionDuration: 60,
  reminderBeforeMinutes: 60,
  bookingFlowOrder: "service_first",
  paymentMoyasarEnabled: true,
  paymentAtClinicEnabled: true,
  paymentBankTransferEnabled: false,
  bankTransferAccounts: [],
  payMethodCashEnabled: true,
  payMethodBankEnabled: true,
  payMethodMadaEnabled: false,
  payMethodTabbyEnabled: false,
  customDomainGraceUntil: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

/** GET /booking-settings with no row: the values only, no row identity. */
const defaultBookingSettings: BookingSettings = {
  clientCancellationPolicyEnabled: false,
  clientCancelCutoffMode: null,
  clientCancelBeforeHours: null,
  earlyCancelRefundPercent: null,
  bufferMinutes: 0,
  freeCancelBeforeHours: 24,
  freeCancelRefundType: "FULL",
  lateCancelRefundPercent: 0,
  maxReschedulesPerBooking: 3,
  autoCompleteAfterHours: 2,
  autoNoShowAfterMinutes: 30,
  autoNoShowAfterEnd: true,
  minBookingLeadMinutes: 60,
  maxAdvanceBookingDays: 90,
  payAtClinicEnabled: false,
  requireCancelApproval: false,
  autoRefundOnCancel: true,
  clientRescheduleMinHoursBefore: 24,
}

describe("organization type contract", () => {
  it("keeps the derived entities aligned with the OpenAPI snapshot", () => {
    // Prisma Decimal columns arrive as decimal strings, never numbers.
    expect(Number(wireSettings.vatRate)).toBe(0.15)
    expect(typeof wireSettings.vatRate).toBe("string")
    // A branch/department with no English name is normalised to "" once.
    expect(wireBranch.nameEn).toBe("")
    expect(wireDepartment.nameEn).toBe("")
    // The department list row carries the real category rows, not a `_count`.
    expect(wireDepartment.categories).toHaveLength(1)
    expect("_count" in wireDepartment).toBe(false)
    // The built-in booking defaults are a complete value object without an id.
    expect(defaultBookingSettings.bufferMinutes).toBe(0)
    expect("id" in defaultBookingSettings).toBe(false)
  })
})
