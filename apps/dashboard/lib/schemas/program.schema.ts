import { z } from 'zod';

/**
 * Programs schema — accepts SAR in the form for staff convenience and
 * multiplies by 100 to integer halalas before sending to the backend.
 * (See packages/shared/money.ts for the unit rationale.)
 */

const halalas = z.number().int().min(0);
const sar = z.number().min(0);

const positiveInt = z.number().int().min(1);

export const createProgramSchema = z.object({
  departmentId: z.string().uuid(),
  branchId: z.string().uuid(),
  nameAr: z.string().min(2),
  nameEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  daysCount: positiveInt,
  hoursPerDay: positiveInt,
  minParticipants: positiveInt,
  maxParticipants: positiveInt,
  /** SAR in the form — converted to halalas at submit time. */
  priceSar: sar,
  currency: z.string().default('SAR'),
  depositEnabled: z.boolean().default(false),
  depositSar: sar.optional(),
  isPublic: z.boolean().default(false),
  publicDescriptionAr: z.string().optional(),
  publicDescriptionEn: z.string().optional(),
  supervisorIds: z.array(z.string().uuid()).min(1, 'At least one supervisor is required'),
}).refine(
  (d) => d.minParticipants <= d.maxParticipants,
  { message: 'minParticipants cannot exceed maxParticipants', path: ['minParticipants'] },
).refine(
  (d) => !d.depositEnabled || (d.depositSar != null && d.depositSar <= d.priceSar),
  { message: 'depositSar cannot exceed priceSar', path: ['depositSar'] },
);

export type CreateProgramFormValues = z.infer<typeof createProgramSchema>;

export function toCreateProgramPayload(values: CreateProgramFormValues) {
  return {
    departmentId: values.departmentId,
    branchId: values.branchId,
    nameAr: values.nameAr,
    nameEn: values.nameEn,
    descriptionAr: values.descriptionAr,
    descriptionEn: values.descriptionEn,
    daysCount: values.daysCount,
    hoursPerDay: values.hoursPerDay,
    minParticipants: values.minParticipants,
    maxParticipants: values.maxParticipants,
    price: Math.round(values.priceSar * 100),
    currency: values.currency,
    depositEnabled: values.depositEnabled,
    depositAmount: values.depositSar != null ? Math.round(values.depositSar * 100) : undefined,
    isPublic: values.isPublic,
    publicDescriptionAr: values.publicDescriptionAr,
    publicDescriptionEn: values.publicDescriptionEn,
    supervisorIds: values.supervisorIds,
  };
}

export const scheduleProgramSchema = z.object({
  startDate: z.string().min(1, 'startDate is required'),
});
export type ScheduleProgramFormValues = z.infer<typeof scheduleProgramSchema>;

export const cancelProgramSchema = z.object({
  reason: z.string().min(2, 'Reason is required'),
});
export type CancelProgramFormValues = z.infer<typeof cancelProgramSchema>;

export const enrollInProgramSchema = z.object({
  clientId: z.string().uuid(),
});
export type EnrollInProgramFormValues = z.infer<typeof enrollInProgramSchema>;

/** Helper used by the form to convert a Prisma Decimal-string to SAR number. */
export function halalasStringToSar(halalas: string | null | undefined): number {
  if (halalas == null) return 0;
  const n = Number(halalas);
  return Number.isFinite(n) ? n / 100 : 0;
}

/** Re-export for forms that just need the integer-hala field. */
export const halalasField = halalas;
