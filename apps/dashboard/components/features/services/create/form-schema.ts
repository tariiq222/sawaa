import { z } from "zod"

/* ─── Zod Schema ─── */

export const createServiceSchema = z.object({
  nameEn: z.string().min(1, "services.create.nameEnRequired"),
  nameAr: z.string().min(1, "services.create.nameArRequired"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  categoryId: z.string().uuid("services.create.categoryRequired"),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  hidePriceOnBooking: z.boolean().optional(),
  hideDurationOnBooking: z.boolean().optional(),
  iconName: z.string().max(100).nullable().optional(),
  iconBgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(120).optional(),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(120).nullable().optional(),
  bufferAfterMinutes: z.coerce.number().int().min(0).max(120).nullable().optional(),
  depositEnabled: z.boolean().optional(),
  depositAmount: z.coerce.number().min(0).nullable().optional(),
  allowRecurring: z.boolean().optional(),
  allowedRecurringPatterns: z.array(z.string()).optional(),
  maxRecurrences: z.coerce.number().int().min(1).max(52).optional(),
  maxParticipants: z.coerce.number().int().min(1).max(100).optional(),
  minLeadMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  calendarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
})

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
  allowRecurring: false,
  allowedRecurringPatterns: [],
  maxRecurrences: 12,
  maxParticipants: 1,
  minLeadMinutes: null,
  maxAdvanceDays: null,
  branchIds: [],
}
