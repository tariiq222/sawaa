import type { Booking, BookingInvoice, DeliveryType } from './booking'
export type LateSessionStatus =
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'NO_SHOW'
  | 'CANCELLED'
export type LatePaymentMode = 'UNPAID' | 'PREVIOUSLY_RECEIVED' | 'COLLECT_NOW'
export type LatePaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'MADA' | 'TABBY'
export interface LateSessionDraft {
  clientId: string
  branchId: string
  employeeId: string
  serviceId: string
  deliveryType: DeliveryType
  scheduledAt: string
  durationMins: string
  status: LateSessionStatus
  amount: string
  notes: string
  paymentMode: LatePaymentMode
  paymentMethod: LatePaymentMethod
  paymentAmount: string
  receivedAt: string
  receiptEvidenceRef: string
  receiptEntryReason: string
  cancelledAt: string
  cancellationReason: string
  noShowAt: string
  priorInvoice: 'NONE' | 'INTERNAL' | 'EXTERNAL'
}
export interface RecordLateSessionPayload {
  clientId: string
  branchId: string
  employeeId: string
  serviceId: string
  deliveryType: DeliveryType
  scheduledAt: string
  durationMins: number
  status: LateSessionStatus
  amountHalalas: number
  notes?: string
  paymentMode: LatePaymentMode
  creationIdempotencyKey: string
  paymentMethod?: LatePaymentMethod
  paymentAmountHalalas?: number
  receivedAt?: string
  receiptEvidenceRef?: string
  receiptEntryReason?: string
  cancelledAt?: string
  cancellationReason?: string
  noShowAt?: string
}
export interface RecordLateSessionResponse {
  booking: Booking
  invoice: BookingInvoice | null
  payment: {
    id: string
    effectiveReceivedAt?: string | null
    createdAt: string
  } | null
  outstanding: number
  isLateEntry: true
  lateEntryRecordedAt: string
  lateEntryRecordedBy: string
}
