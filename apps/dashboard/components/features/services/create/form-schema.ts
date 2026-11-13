import { z } from "zod"
import { entityId, formNumber } from "@/lib/schemas/primitives"

/* ─── Zod Schema ─── */

export const createServiceSchema = z.object({
  nameEn: z.string().min(1, "services.create.nameEnRequired"),
  nameAr: z.string().min(1, "services.create.nameArRequired"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: entityId("services.create.categoryRequired"),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  hidePriceOnBooking: z.boolean().optional(),
  hideDurationOnBooking: z.boolean().optional(),
  iconName: z.string().max(100).nullable().optional(),
  iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  bufferMinutes: formNumber().int().min(0).max(120).optional(),
  bufferBeforeMinutes: formNumber().int().min(0).max(120).nullable().optional(),
  bufferAfterMinutes: formNumber().int().min(0).max(120).nullable().optional(),
  depositEnabled: z.boolean().optional(),
  depositAmount: formNumber().min(0).nullable().optional(),
  minLeadMinutes: formNumber().int().min(0).max(1440).nullable().optional(),
  maxAdvanceDays: formNumber().int().min(1).max(365).nullable().optional(),
  branchIds: z.array(entityId()).optional(),
  calendarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
})

// Preserve legacy missing categories and names, but require a replacement when
// the saved English name was populated. Non-empty category IDs stay UUID-validated.
export function createServiceEditSchema(savedNameEn?: string | null) {
  const nameEnSchema = savedNameEn
    ? z.string().min(1, "services.create.nameEnRequired")
    : z.union([z.string().min(1, "services.create.nameEnRequired"), z.literal("")])

  return createServiceSchema.extend({
    nameEn: nameEnSchema,
    categoryId: z.union([entityId("services.create.categoryRequired"), z.literal("")]).optional(),
  })
}

export type CreateServiceFormData = z.infer<typeof createServiceSchema>

/* ─── Default Values ─── */

export const createServiceDefaults: CreateServiceFormData = {
  nameEn: "",
  nameAr: "",
  descriptionEn: "",
  descriptionAr: "",
  categoryId: "" as string,
  isActive: true,
  isHidden: false,
  hidePriceOnBooking: false,
  hideDurationOnBooking: false,
  iconName: null,
  iconBgColor: null,
  imageUrl: null,
  bufferMinutes: undefined,
  depositEnabled: false,
  depositAmount: null,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  branchIds: [],
}
