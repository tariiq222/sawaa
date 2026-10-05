import { grossWithVat } from '@/lib/money'
import { z } from 'zod'
import { moneyInputToHalalas } from '@/lib/money-input'
import type {
  LateSessionDraft,
  RecordLateSessionPayload,
} from '@/lib/types/late-session'
export const defaultLateSessionDraft: LateSessionDraft = {
  clientId: '',
  branchId: '',
  employeeId: '',
  serviceId: '',
  deliveryType: 'IN_PERSON',
  scheduledAt: '',
  durationMins: '60',
  status: 'COMPLETED',
  amount: '0',
  notes: '',
  paymentMode: 'UNPAID',
  paymentMethod: 'CASH',
  paymentAmount: '',
  receivedAt: '',
  receiptEvidenceRef: '',
  receiptEntryReason: '',
  cancelledAt: '',
  cancellationReason: '',
  noShowAt: '',
  priorInvoice: 'NONE',
}
const required = z.string().trim().min(1)
const base = z.object({
  clientId: required,
  branchId: required,
  employeeId: required,
  serviceId: required,
  deliveryType: z.enum(['IN_PERSON', 'ONLINE']),
  scheduledAt: required,
  durationMins: z.coerce.number().int().positive(),
  status: z.enum(['COMPLETED', 'CONFIRMED', 'NO_SHOW', 'CANCELLED']),
  paymentMode: z.enum(['UNPAID', 'PREVIOUSLY_RECEIVED', 'COLLECT_NOW']),
})
function past(value: string, now: Date): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('bookings.late.invalidDate')
  const date = new Date(`${value}:00+03:00`)
  if (!Number.isFinite(date.getTime()) || date >= now)
    throw new Error('bookings.late.invalidDate')
  if (
    new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 16) !== value
  )
    throw new Error('bookings.late.invalidDate')
  return date.toISOString()
}
export function buildLateSessionPayload(
  draft: LateSessionDraft,
  key: string,
  now = new Date(),
  vatRate = 0
): RecordLateSessionPayload {
  if (draft.priorInvoice !== 'NONE')
    throw new Error('bookings.late.priorInvoiceBlocked')
  const parsed = base.safeParse(draft)
  if (!parsed.success) throw new Error('bookings.late.invalidFields')
  const d = parsed.data
  const amountHalalas = moneyInputToHalalas(draft.amount)
  if (amountHalalas === null) throw new Error('bookings.late.invalidAmount')
  const scheduledAt = past(d.scheduledAt, now)
  if (
    d.status === 'COMPLETED' &&
    new Date(scheduledAt).getTime() + d.durationMins * 60000 >= now.getTime()
  )
    throw new Error('bookings.late.notEnded')
  if (
    ['NO_SHOW', 'CANCELLED'].includes(d.status) &&
    (amountHalalas !== 0 || d.paymentMode !== 'UNPAID')
  )
    throw new Error('bookings.late.terminalFinancial')
  const result: RecordLateSessionPayload = {
    ...d,
    scheduledAt,
    amountHalalas,
    creationIdempotencyKey: key,
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
  }
  if (d.status === 'CANCELLED') {
    if (!draft.cancellationReason.trim())
      throw new Error('bookings.late.invalidFields')
    result.cancelledAt = past(draft.cancelledAt, now)
    result.cancellationReason = draft.cancellationReason.trim()
  }
  if (d.status === 'NO_SHOW') {
    result.noShowAt = past(draft.noShowAt, now)
    if (result.noShowAt < scheduledAt)
      throw new Error('bookings.late.invalidDate')
  }
  if (d.paymentMode !== 'UNPAID') {
    const paid = moneyInputToHalalas(draft.paymentAmount)
    if (!paid || paid > grossWithVat(amountHalalas, vatRate))
      throw new Error('bookings.late.invalidAmount')
    result.paymentMethod = draft.paymentMethod
    result.paymentAmountHalalas = paid
    if (d.paymentMode === 'PREVIOUSLY_RECEIVED') {
      if (!draft.receiptEvidenceRef.trim() || !draft.receiptEntryReason.trim())
        throw new Error('bookings.late.invalidFields')
      result.receivedAt = past(draft.receivedAt, now)
      result.receiptEvidenceRef = draft.receiptEvidenceRef.trim()
      result.receiptEntryReason = draft.receiptEntryReason.trim()
    }
  }
  return result
}
