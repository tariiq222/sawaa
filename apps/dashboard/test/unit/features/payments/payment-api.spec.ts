import { afterEach, expect, it, vi } from 'vitest'
import { fetchPayments, fetchPayment } from '@/lib/api/payments'
import { setAccessToken } from '@/lib/api'
afterEach(()=>vi.unstubAllGlobals())
it('preserves collection projection, audit metadata and server ordering on date-filtered list and detail', async()=>{
  setAccessToken('token')
  const previous = {id:'previous',collectionDate:'2026-09-01T10:00:00Z',effectiveReceivedAt:'2026-09-01T10:00:00Z',createdAt:'2026-10-05T12:00:00Z',processedAt:'2026-10-05T12:00:00Z',receiptRecordedBy:'staff',receiptEvidenceRef:'R42',receiptEntryReason:'Late entry'}
  const ordinary = {id:'ordinary',createdAt:'2026-08-01T10:00:00Z',effectiveReceivedAt:null}
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:{items:[previous,ordinary],meta:{total:2}}}))).mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:previous})))
  vi.stubGlobal('fetch',fetch)
  const result = await fetchPayments({dateFrom:'2026-08-01',dateTo:'2026-09-30'})
  expect(result.items).toEqual([previous,ordinary])
  expect(fetch.mock.calls[0][0]).toBe('/api/proxy/dashboard/finance/payments?fromDate=2026-08-01&toDate=2026-09-30')
  expect(await fetchPayment('previous')).toEqual(previous)
})
