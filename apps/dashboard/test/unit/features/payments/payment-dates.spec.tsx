import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createTable, getCoreRowModel, getSortedRowModel } from '@tanstack/react-table'
import { getPaymentColumns } from '@/components/features/payments/payment-columns'
import { PaymentReceiptAudit } from '@/components/features/payments/payment-receipt-audit'
import type { Payment } from '@/lib/types/payment'
vi.mock('@/components/locale-provider', () => ({ useLocale: () => ({ t: (k: string) => k, locale: 'en' }) }))
const previous = { id:'previous', createdAt:'2026-10-05T12:00:00Z', processedAt:'2026-10-05T12:01:00Z', effectiveReceivedAt:'2026-09-01T10:00:00Z', collectionDate:'2026-09-01T10:00:00Z', receiptRecordedBy:'staff-1', receiptEvidenceRef:'receipt-42', receiptEntryReason:'Archived receipt' } as Payment
it('uses collection date for table values and sorting, with ordinary and legacy fallbacks', () => {
  const ordinary = { id:'ordinary', createdAt:'2026-09-20T10:00:00Z', effectiveReceivedAt:null } as Payment
  const legacy = { ...previous, id:'legacy', collectionDate:undefined, effectiveReceivedAt:'2026-09-10T10:00:00Z' }
  const table = createTable({ data:[ordinary, previous, legacy], columns:getPaymentColumns(), state:{ sorting:[{ id:'collectionDate', desc:false }] }, onStateChange:()=>{}, renderFallbackValue:null, getCoreRowModel:getCoreRowModel(), getSortedRowModel:getSortedRowModel() })
  expect(table.getRowModel().rows.map(row=>row.original.id)).toEqual(['previous','legacy','ordinary'])
  expect(table.getRowModel().rows.map(row=>row.getValue('collectionDate'))).toEqual(['2026-09-01T10:00:00Z','2026-09-10T10:00:00Z','2026-09-20T10:00:00Z'])
})
it('shows actual receipt, immutable recorded/processed times and evidence separately', () => {
  render(<PaymentReceiptAudit payment={previous} />)
  expect(screen.getByText('receipt-42')).toBeInTheDocument()
  expect(screen.getByText('staff-1')).toBeInTheDocument()
  expect(screen.getByText('Archived receipt')).toBeInTheDocument()
  expect(screen.getByText('payments.audit.recordedAt:').parentElement).toHaveTextContent('10/5/2026')
  expect(screen.getByText('payments.audit.receivedAt:').parentElement).toHaveTextContent('9/1/2026')
  expect(screen.getByText('payments.audit.processedAt:').parentElement).toHaveTextContent('10/5/2026')
})
