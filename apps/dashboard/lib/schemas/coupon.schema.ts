import { z } from "zod"

/* ─── Coupon schema (coupon-form-page) ─── */

export const couponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/i),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  // FIXED coupons accept fractional SAR (e.g. 49.50); the form's
  // toStorageValue converts to integer halalas on submit. PERCENTAGE is a
  // raw 0-100 percent. Either way, fractional input must be allowed here.
  discountValue: z.coerce.number().min(0.01),
  minOrderAmt: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxUsesPerUser: z.coerce.number().int().min(1).optional().or(z.literal("")),
  serviceIds: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean(),
})

export type CouponFormData = z.infer<typeof couponSchema>
