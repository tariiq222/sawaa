/**
 * Contract test for the dashboard finance & identity types (MNT-08).
 *
 * Every RESPONSE shape in `lib/types/{invoice,payment,coupon,package-purchase,
 * credit-booking,credit-ops,user}.ts` that the snapshot documents is derived
 * from `components["schemas"]` / the operation bodies, and `lib/api/*` speaks to
 * those routes through `lib/api/openapi.ts`. These assertions run at type-check
 * time (`pnpm typecheck`) and at test time, and fail when the wire shape moves
 * underneath the dashboard — or when a documented deviation stops being a
 * deviation.
 */
import { describe, expect, it } from "vitest"
import type { components, paths } from "@/lib/types/api.generated"
import type {
  EnsuredBookingInvoice,
  InvoiceDetail,
  InvoiceListPage,
  InvoiceListRow,
  InvoicePdfUrl,
  InvoiceRecord,
  InvoiceStatus,
} from "@/lib/types/invoice"
import type {
  CollectBookingPaymentResult,
  HistoricalPaymentStats,
  Payment,
  PaymentDetail,
  PaymentListPage,
  PaymentListRow,
  PaymentRecord,
  PaymentRefundRequest,
  PaymentStats,
} from "@/lib/types/payment"
import type { Coupon, CouponListPage, CouponRedemption } from "@/lib/types/coupon"
import type { PackageCredit } from "@/lib/types/package-purchase"
import type {
  BookFromCreditPayload,
  MatchingCredit,
} from "@/lib/types/credit-booking"
import type {
  RefundPackagePurchasePayload,
  RefundPackagePurchaseResult,
  TransferCreditPayload,
  TransferCreditResult,
} from "@/lib/types/credit-ops"
import type {
  CreateUserPayload,
  Permission,
  Role,
  UpdateUserPayload,
  User,
  UserRole,
} from "@/lib/types/user"
import type { MoyasarConfig, TestMoyasarConfigResult } from "@/lib/api/moyasar-config"
import type { RefundReviewResult } from "@/lib/api/refund-review"

type Schemas = components["schemas"]
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

/** The JSON body of a concrete operation's success response. */
type JsonResponse<
  Path extends keyof paths,
  Method extends keyof paths[Path],
> = paths[Path][Method] extends { responses: infer Responses }
  ? Responses[Extract<keyof Responses, 200 | 201>] extends {
      content: { "application/json": infer Body }
    }
    ? Body
    : never
  : never

/* ─── Invoices ─── */

type _InvoiceRowIsWire = Expect<Equal<InvoiceListRow, Schemas["InvoiceListRowDto"]>>
type _InvoiceListIsWire = Expect<Equal<InvoiceListPage, Schemas["InvoiceListResponseDto"]>>
type _InvoiceRecordIsWire = Expect<Equal<InvoiceRecord, Schemas["InvoiceRecordDto"]>>
type _InvoiceDetailIsWire = Expect<Equal<InvoiceDetail, Schemas["InvoiceDetailResponseDto"]>>
type _InvoicePdfIsWire = Expect<Equal<InvoicePdfUrl, Schemas["InvoicePdfUrlDto"]>>
type _EnsuredIsWire = Expect<Equal<EnsuredBookingInvoice, Schemas["EnsuredInvoiceDto"]>>
type _InvoiceStatusIsWire = Expect<Equal<InvoiceStatus, Schemas["InvoiceStatus"]>>
/** Money columns are Prisma Decimals: decimal strings on the wire, never floats. */
type _InvoiceMoneyIsString = Expect<
  Equal<[InvoiceListRow["subtotal"], InvoiceRecord["total"], InvoiceRecord["vatRate"]], [string, string, string]>
>
/** The detail read is the row plus payments. */
type _InvoiceDetailAddsOnlyPayments = Expect<
  Equal<Exclude<keyof InvoiceDetail, keyof InvoiceRecord>, "payments">
>
type _InvoiceListIsOperationBody = Expect<
  Equal<InvoiceListPage, JsonResponse<"/api/v1/dashboard/finance/invoices", "get">>
>

/* ─── Payments ─── */

type _PaymentRecordIsWire = Expect<Equal<PaymentRecord, Schemas["PaymentRecordDto"]>>
type _PaymentListRowIsWire = Expect<Equal<PaymentListRow, Schemas["PaymentListRowDto"]>>
type _PaymentListIsWire = Expect<Equal<PaymentListPage, Schemas["PaymentListResponseDto"]>>
type _PaymentDetailIsWire = Expect<Equal<PaymentDetail, Schemas["PaymentDetailResponseDto"]>>
type _PaymentStatsIsWire = Expect<Equal<PaymentStats, Schemas["PaymentStatsResponseDto"]>>
type _HistoricalIsWire = Expect<Equal<HistoricalPaymentStats, Schemas["PaymentHistoricalStatsDto"]>>
type _RefundRequestIsWire = Expect<Equal<PaymentRefundRequest, Schemas["PaymentRefundRequestRowDto"]>>
type _CollectionIsWire = Expect<Equal<CollectBookingPaymentResult, Schemas["PaymentCollectionResponseDto"]>>
/** Payment-row money is a Decimal string; the stats aggregate is a number. */
type _PaymentMoneyIsString = Expect<Equal<PaymentRecord["amount"], string>>
type _StatsMoneyIsNumber = Expect<Equal<PaymentStats["totalAmount"], number>>
type _StatsHistoricalIsWire = Expect<Equal<PaymentStats["historical"], HistoricalPaymentStats>>
/** `Payment` is the row plus the documented optional list/detail extras. */
type _PaymentAddsOnlyOptional = Expect<
  Equal<
    Exclude<keyof Payment, keyof PaymentRecord>,
    "collectionDate" | "invoice" | "refundRequests" | "receipts"
  >
>
type _PaymentExtrasAreOptional = Expect<
  [Payment["collectionDate"], Payment["invoice"], Payment["refundRequests"], Payment["receipts"]] extends [
    undefined | string,
    undefined | null | object,
    undefined | unknown[],
    undefined | unknown[],
  ]
    ? true
    : false
>
/** `receipts` is the one legacy field no handler sends. */
type _ReceiptsIsLegacyOnly = Expect<Equal<Extract<"receipts", keyof PaymentRecord>, never>>

/* ─── Coupons ─── */

type _CouponIsWire = Expect<Equal<Coupon, Schemas["CouponRecordDto"]>>
type _CouponListIsWire = Expect<Equal<CouponListPage, Schemas["CouponListResponseDto"]>>
type _CouponRedemptionIsWire = Expect<Equal<CouponRedemption, Schemas["CouponRedemptionRecordDto"]>>
type _CouponMoneyIsString = Expect<Equal<[Coupon["discountValue"], Coupon["minOrderAmt"]], [string, string | null]>>

/* ─── Package purchases (refund + client list) ─── */

type _PackageRefundIsWire = Expect<Equal<RefundPackagePurchaseResult, Schemas["PackagePurchaseRefundResponseDto"]>>
type _PackageCreditWireRow = Expect<
  Equal<Omit<PackageCredit, "modelVersion" | "purchaseGroupId" | "sessionPosition" | "groupLabel" | "sequenceMode" | "dependsOnGroupId" | "durationMinsSnapshot" | "deliveryTypeSnapshot" | "serviceNameSnapshot" | "employeeNameSnapshot" | "listPriceSnapshot" | "netValue" | "availability">, Omit<Schemas["PackagePurchaseCreditDto"], "purchaseGroupId" | "sessionPosition" | "groupLabel" | "sequenceMode" | "dependsOnGroupId" | "durationMinsSnapshot" | "deliveryTypeSnapshot" | "serviceNameSnapshot" | "employeeNameSnapshot" | "listPriceSnapshot" | "netValue" | "availability">>
>
/** Refund money is integer halalas in the response. */
type _RefundAmountIsNumber = Expect<Equal<RefundPackagePurchaseResult["refundAmount"], number>>
/** The purchase view keeps the documented credits array and its optional extras. */
type _PurchaseCreditsAreDashboardCredits = Expect<
  Equal<import("@/lib/types/package-purchase").PackagePurchase["credits"], PackageCredit[]>
>

/* ─── Credit booking / ops (documented by the bookings controller) ─── */

type _MatchingCreditIsWire = Expect<Equal<MatchingCredit, Schemas["MatchingCreditDto"]>>
type _BookFromCreditIsWire = Expect<Equal<BookFromCreditPayload, Schemas["BookFromCreditDto"]>>
type _TransferPayloadIsWire = Expect<Equal<TransferCreditPayload, Schemas["TransferCreditDto"]>>
type _TransferResultIsWire = Expect<Equal<TransferCreditResult, Schemas["PackageCreditRecordDto"]>>
type _RefundPayloadIsWire = Expect<Equal<RefundPackagePurchasePayload, Schemas["RefundPackagePurchaseDto"]>>
type _RefundResultIsWire = Expect<Equal<RefundPackagePurchaseResult, Schemas["PackagePurchaseRefundResponseDto"]>>

/* ─── Identity ─── */

type _UserIsWire = Expect<Equal<User, Schemas["DashboardUserResponseDto"]>>
type _RoleIsWire = Expect<Equal<Role, Schemas["IdentityRoleDto"]>>
type _UserRoleIsWire = Expect<Equal<UserRole, Schemas["UserRole"]>>
type _CreateUserIsWire = Expect<Equal<CreateUserPayload, Schemas["CreateUserDto"]>>
type _UpdateUserIsWire = Expect<Equal<UpdateUserPayload, Schemas["UpdateUserDto"]>>
type _PermissionCoversBoth = Expect<
  Equal<
    Extract<Permission, { module: unknown }>,
    Schemas["IdentityPermissionCatalogEntryDto"]
  >
>
/** No auth secret crosses the documented identity write shape. */
type _UserHasNoHash = Expect<Equal<Extract<"passwordHash", keyof User>, never>>
type _CreateUserHasNoHash = Expect<Equal<Extract<"passwordHash", keyof CreateUserPayload>, never>>

/* ─── Moyasar: masked view + review projection ─── */

type _MoyasarViewIsWire = Expect<Equal<MoyasarConfig, Schemas["MoyasarConfigViewDto"]>>
type _MoyasarTestIsWire = Expect<Equal<TestMoyasarConfigResult, Schemas["MoyasarConfigTestResponseDto"]>>
type _ReviewResultIsApproval = Expect<Equal<RefundReviewResult, Schemas["RefundApprovalResponseDto"]>>

type SecretKeys =
  | "secretKey"
  | "secretKeyEnc"
  | "webhookSecret"
  | "webhookSecretEnc"
  | "ciphertext"
  | "credentials"
type _MoyasarViewHasNoSecret = Expect<Equal<Extract<SecretKeys, keyof MoyasarConfig>, never>>

/* ─── Runtime samples ─── */

const invoiceRow: InvoiceListRow = {
  id: "inv-1",
  number: 1,
  clientId: "c-1",
  bookingId: null,
  clientName: "Sara",
  subtotal: "10000",
  vatAmt: "0",
  total: "10000",
  refundedAmount: "0",
  currency: "SAR",
  status: "PAID",
  issuedAt: "2026-01-01T00:00:00.000Z",
  paidAt: "2026-01-01T00:00:00.000Z",
  sentToClientAt: null,
  hasPdf: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

const coupon: Coupon = {
  id: "cpn-1",
  ref: 1,
  code: "WELCOME10",
  descriptionAr: null,
  descriptionEn: null,
  discountType: "PERCENTAGE",
  discountValue: "10",
  maxUses: null,
  usedCount: 0,
  minOrderAmt: null,
  expiresAt: null,
  isActive: true,
  maxUsesPerUser: null,
  serviceIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

describe("finance & identity type contract", () => {
  it("keeps the dashboard entities aligned with the OpenAPI snapshot", () => {
    expect(Number(invoiceRow.total)).toBe(10000)
    expect(invoiceRow.status).toBe("PAID")
    expect(coupon.discountType).toBe("PERCENTAGE")
    expect(Number(coupon.discountValue)).toBe(10)
  })
})
