import { describe, expect, test } from "vitest"

import { resolveSelectedPackageSummary } from "@/components/features/bookings/selected-package-summary"
import type { PackageCredit, PackagePurchase } from "@/lib/types/package-purchase"

const credit: PackageCredit = {
  id: "credit-1",
  serviceId: "service-1",
  employeeId: "employee-1",
  durationOptionId: "duration-1",
  serviceNameAr: "استشارة أسرية",
  serviceNameEn: "Family consultation",
  employeeNameAr: "أحمد",
  employeeNameEn: "Ahmad",
  durationLabelAr: "٦٠ دقيقة",
  durationLabelEn: "60 minutes",
  durationMins: 60,
  unitPriceSnapshot: 30_000,
  totalQuantity: 4,
  usedQuantity: 1,
  reservedQuantity: 0,
  remaining: 1,
  categoryId: "category-1",
  categoryNameAr: "الاستشارات الأسرية",
  categoryNameEn: "Family counseling",
  categoryBookingMode: "SERVICES",
  departmentId: "department-1",
  departmentNameAr: "الاستشارات",
  departmentNameEn: "Counseling",
  serviceIsBookable: true,
  constraints: [],
  modelVersion: "GROUPED_V2",
  sessionPosition: 2,
}

const purchase: PackagePurchase = {
  id: "purchase-1",
  packageId: "package-1",
  packageNameAr: "باقة الأسرة",
  packageNameEn: "Family package",
  status: "ACTIVE",
  subtotalSnapshot: 120_000,
  discountSnapshot: 0,
  amountPaid: 120_000,
  refundAmount: 0,
  paidAt: "2026-09-14T00:00:00.000Z",
  refundedAt: null,
  notes: null,
  createdAt: "2026-09-14T00:00:00.000Z",
  credits: [credit, { ...credit, id: "credit-2", remaining: 3 }],
}

describe("resolveSelectedPackageSummary", () => {
  test("matches the current purchase and credit and localizes their details", () => {
    expect(
      resolveSelectedPackageSummary({
        clientId: "client-1",
        packagePurchaseId: purchase.id,
        packageCreditId: credit.id,
        creditFilter: null,
        purchases: [purchase],
        locale: "en",
      }),
    ).toEqual({
      packageName: "Family package",
      sessionPosition: 2,
      serviceName: "Family consultation",
      remaining: 4,
    })
  })

  test("clears when the client or selected IDs are reset and rejects mismatched credits", () => {
    const base = {
      packagePurchaseId: purchase.id,
      packageCreditId: credit.id,
      creditFilter: null,
      purchases: [purchase],
      locale: "ar" as const,
    }
    expect(resolveSelectedPackageSummary({ clientId: null, ...base })).toBeNull()
    expect(
      resolveSelectedPackageSummary({
        clientId: "client-1",
        ...base,
        packagePurchaseId: null,
        packageCreditId: null,
      }),
    ).toBeNull()
    expect(
      resolveSelectedPackageSummary({
        clientId: "client-1",
        ...base,
        packageCreditId: "credit-from-another-purchase",
      }),
    ).toBeNull()
  })

  test("legacy purchase without credit metadata safely shows only its current purchase name", () => {
    expect(
      resolveSelectedPackageSummary({
        clientId: "client-1",
        packagePurchaseId: purchase.id,
        packageCreditId: null,
        creditFilter: null,
        purchases: [{ ...purchase, credits: [{ ...credit, sessionPosition: null }] }],
        locale: "ar",
      }),
    ).toEqual({
      packageName: "باقة الأسرة",
      sessionPosition: null,
      serviceName: null,
      remaining: 1,
    })
  })
})
