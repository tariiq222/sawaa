import { z } from 'zod'

/**
 * Session-package input schemas (cross-app).
 *
 * These mirror the backend DTOs in
 * `apps/backend/src/modules/org-experience/session-packages/{create,update}-session-package/`
 * and are used by the dashboard form, the website / mobile purchase flow,
 * and the api-client payload types. Money fields are integer halalas for
 * FIXED discounts; PERCENTAGE discounts use a 0..100 percentage.
 */

/** Mirrors the Prisma enum `DiscountType` in `finance.prisma`. */
export const discountTypeSchema = z.enum(['PERCENTAGE', 'FIXED'])

/** Mirrors the Prisma enum `PackagePurchaseStatus` in `bookings.prisma`. */
export const packagePurchaseStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'REFUNDED',
])

/** Mirrors the Prisma enum `PackageCreditUsageStatus` in `bookings.prisma`. */
export const packageCreditUsageStatusSchema = z.enum(['CONSUMED', 'RETURNED'])

/** Canonical price breakdown returned by the GET endpoint. All in halalas. */
export const packagePriceBreakdownSchema = z.object({
  subtotal: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative(),
  finalPrice: z.number().int().nonnegative(),
  itemUnitPrices: z.array(
    z.object({
      durationOptionId: z.string().uuid(),
      unitPrice: z.number().int().nonnegative(),
    }),
  ),
})

/** A single item inside a SessionPackage (definition row). */
export const sessionPackageItemInputSchema = z.object({
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid(),
  durationOptionId: z.string().uuid(),
  paidQuantity: z.number().int().min(0),
  freeQuantity: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

/**
 * Create payload for `POST /dashboard/organization/packages`.
 *
 * Cross-field rule (paidQuantity + freeQuantity >= 1 on every item) is
 * enforced server-side; we duplicate it here with a `superRefine` so the
 * dashboard form can show the error before the round-trip.
 */
export const createSessionPackageSchema = z
  .object({
    nameAr: z.string().min(1).max(200),
    nameEn: z.string().max(200).optional(),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    imageUrl: z.string().optional(),
    iconName: z.string().optional(),
    iconBgColor: z.string().optional(),
    discountType: discountTypeSchema,
    /**
     * Integer halalas for FIXED, 0..100 for PERCENTAGE. The handler also
     * rejects PERCENTAGE > 100 and FIXED > computed subtotal — those are
     * enforced after the pricing service runs, so we can't validate them
     * here without re-running the pricing logic.
     */
    discountValue: z.number().int().min(0),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    items: z.array(sessionPackageItemInputSchema).min(1),
  })
  .superRefine((value, ctx) => {
    value.items.forEach((item, idx) => {
      const paid = item.paidQuantity ?? 0
      const free = item.freeQuantity ?? 0
      if (paid + free < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', idx],
          message: 'Each item must have at least one session (paidQuantity + freeQuantity >= 1)',
        })
      }
    })
  })

/**
 * Update payload for `PATCH /dashboard/organization/packages/:id`. All
 * fields are optional; when `items` is provided it is a *full replacement*
 * set (delete-and-create semantics in the handler).
 */
export const updateSessionPackageSchema = z
  .object({
    nameAr: z.string().min(1).max(200).optional(),
    nameEn: z.string().max(200).optional(),
    descriptionAr: z.string().optional(),
    descriptionEn: z.string().optional(),
    imageUrl: z.string().optional(),
    iconName: z.string().optional(),
    iconBgColor: z.string().optional(),
    discountType: discountTypeSchema.optional(),
    discountValue: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isPublic: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    items: z.array(sessionPackageItemInputSchema).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.items) return
    value.items.forEach((item, idx) => {
      const paid = item.paidQuantity ?? 0
      const free = item.freeQuantity ?? 0
      if (paid + free < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', idx],
          message: 'Each item must have at least one session (paidQuantity + freeQuantity >= 1)',
        })
      }
    })
  })

/** Convenience aliases derived from the schemas. */
export type CreateSessionPackageInput = z.infer<typeof createSessionPackageSchema>
export type UpdateSessionPackageInput = z.infer<typeof updateSessionPackageSchema>
export type SessionPackageItemInput = z.infer<typeof sessionPackageItemInputSchema>
export type PackagePriceBreakdownShape = z.infer<typeof packagePriceBreakdownSchema>
