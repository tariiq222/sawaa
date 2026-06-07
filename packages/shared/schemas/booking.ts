import { z } from 'zod'

export const bookingStatusSchema = z.enum([
  'pending',
  'pending_group_fill',
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
  'expired',
  'cancel_requested',
])

export const bookingTypeSchema = z.enum(['individual', 'walk_in', 'group'])
export const deliveryTypeSchema = z.enum(['IN_PERSON', 'ONLINE'])

export const createBookingSchema = z.object({
  employeeId: z.string().uuid(),
  serviceId: z.string().uuid(),
  type: bookingTypeSchema.optional(),
  deliveryType: deliveryTypeSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  clientId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  branchId: z.string().uuid().optional(),
  durationOptionId: z.string().uuid().optional(),
  payAtClinic: z.boolean().optional(),
  couponCode: z.string().optional(),
})

export const updateBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  adminNotes: z.string().max(2000).optional(),
})
