import { z } from 'zod'

export const paymentMethodSchema = z.enum(['MOYASAR', 'BANK_TRANSFER', 'CASH'])
export const paymentStatusSchema = z.enum([
  'PENDING',
  'PENDING_VERIFICATION',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
])

export const processPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  method: paymentMethodSchema,
  amount: z.number().int().positive(),
})

export const refundPaymentSchema = z.object({
  reason: z.string().min(1).max(500),
  amount: z.number().int().positive().optional(),
})

export const verifyPaymentSchema = z.object({
  action: z.enum(['approve', 'reject']),
  transferRef: z.string().optional(),
})
