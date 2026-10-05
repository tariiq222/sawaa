import { describe, expect, it } from "vitest"
import { buildLateSessionPayload, defaultLateSessionDraft } from "@/lib/schemas/late-session.schema"
const now = new Date('2026-10-05T12:00:00Z')
const draft = { ...defaultLateSessionDraft, clientId: 'client', branchId: 'branch', employeeId: 'employee', serviceId: 'service', scheduledAt: '2026-10-05T10:00', amount: '400', durationMins: '60' }
describe('late session payload', () => {
  it('defaults completed and converts Riyadh same-day time and SAR to halalas', () => {
    expect(buildLateSessionPayload(draft, 'key', now)).toMatchObject({ status: 'COMPLETED', scheduledAt: '2026-10-05T07:00:00.000Z', amountHalalas: 40000, durationMins: 60 })
  })
  it('records a partial previous receipt including prepayment date', () => {
    expect(buildLateSessionPayload({ ...draft, paymentMode: 'PREVIOUSLY_RECEIVED', paymentAmount: '150', receivedAt: '2026-10-04T12:00', receiptEvidenceRef: 'receipt-1', receiptEntryReason: 'Late entry' }, 'key', now)).toMatchObject({ paymentAmountHalalas: 15000, receivedAt: '2026-10-04T09:00:00.000Z' })
  })
  it('omits stale conditional fields for unpaid and collect-now modes', () => {
    const dirty = { ...draft, receivedAt: '2026-10-04T12:00', receiptEvidenceRef: 'old', paymentAmount: '100' }
    expect(buildLateSessionPayload(dirty, 'key', now)).not.toHaveProperty('paymentMethod')
    expect(buildLateSessionPayload({ ...dirty, paymentMode: 'COLLECT_NOW' }, 'key', now)).not.toHaveProperty('receivedAt')
  })
  it('rejects unsupported prior invoices and financial terminal states', () => {
    expect(() => buildLateSessionPayload({ ...draft, priorInvoice: 'EXTERNAL' }, 'key', now)).toThrow()
    expect(() => buildLateSessionPayload({ ...draft, priorInvoice: 'INTERNAL' }, 'key', now)).toThrow()
    expect(() => buildLateSessionPayload({ ...draft, status: 'NO_SHOW', noShowAt: '2026-10-05T11:00' }, 'key', now)).toThrow()
    expect(buildLateSessionPayload({ ...draft, status: 'NO_SHOW', amount: '0', noShowAt: '2026-10-05T11:00' }, 'key', now)).toMatchObject({ amountHalalas: 0, paymentMode: 'UNPAID' })
  })
  it('rejects future dates, incomplete completed sessions, and missing receipt evidence', () => {
    expect(() => buildLateSessionPayload({ ...draft, scheduledAt: '2026-10-05T15:30' }, 'key', now)).toThrow()
    expect(() => buildLateSessionPayload({ ...draft, scheduledAt: '2026-10-05T14:30' }, 'key', now)).toThrow()
    expect(() => buildLateSessionPayload({ ...draft, paymentMode: 'PREVIOUSLY_RECEIVED', paymentAmount: '150' }, 'key', now)).toThrow()
  })
})

it('rejects a non-existent calendar date instead of rolling it into March', () => {
  expect(() => buildLateSessionPayload({ ...draft, scheduledAt:'2026-02-31T10:00' }, 'key', now)).toThrow()
})

it('accepts full receipt using established decimal-safe VAT rounding', () => {
  const result = buildLateSessionPayload({ ...draft, amount: '1', paymentMode: 'COLLECT_NOW', paymentAmount: '1.15' }, 'key', now, 0.145)
  expect(result).toMatchObject({ amountHalalas: 100, paymentAmountHalalas: 115 })
})
