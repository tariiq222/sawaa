import { afterEach, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import { listBookings, recordLateSession, getLateSessionContext } from '../bookings'
import type { RecordLateSessionPayload } from '../../types/booking'
afterEach(()=>vi.unstubAllGlobals())
it.each([true,false])('preserves explicit late-entry filter %s', async (isLateEntry)=>{
  initClient({ baseUrl:'http://api.test', getAccessToken:()=> 'token', onTokenRefreshed:()=>{}, onAuthFailure:()=>{} })
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({success:true,data:{items:[]}})))
  vi.stubGlobal('fetch',fetch)
  await listBookings({isLateEntry})
  const request = fetch.mock.calls[0]
  if (!request) throw new Error('Expected a fetch request')
  expect(request[0]).toBe(`http://api.test/dashboard/bookings?isLateEntry=${isLateEntry}`)
})
it('posts the exact staff receipt payload and preserves mapped booking and halala response', async()=>{
  initClient({baseUrl:'http://api.test',getAccessToken:()=> 'token', onTokenRefreshed:()=>{}, onAuthFailure:()=>{}})
  const payload: RecordLateSessionPayload = {clientId:'c',branchId:'b',employeeId:'e',serviceId:'s',deliveryType:'IN_PERSON',scheduledAt:'2026-09-02T10:00:00Z',durationMins:60,status:'COMPLETED',amountHalalas:40000,paymentMode:'PREVIOUSLY_RECEIVED',paymentMethod:'CASH',paymentAmountHalalas:15000,receivedAt:'2026-09-01T10:00:00Z',receiptEvidenceRef:'R42',receiptEntryReason:'Late record',creationIdempotencyKey:'key'}
  const response = {booking:{id:'booking',status:'completed',isLateEntry:true},invoice:{id:'invoice',total:40000},payment:{id:'payment',amount:15000,effectiveReceivedAt:payload.receivedAt},outstanding:25000,isLateEntry:true,lateEntryRecordedAt:'2026-10-05T12:00:00Z',lateEntryRecordedBy:'staff'}
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({success:true,data:response})))
  vi.stubGlobal('fetch',fetch)
  expect(await recordLateSession(payload)).toEqual(response)
  const request = fetch.mock.calls[0]
  if (!request) throw new Error('Expected a fetch request')
  expect(request[0]).toBe('http://api.test/dashboard/bookings/late-entry')
  const init = request[1]
  if (typeof init?.body !== 'string') throw new Error('Expected JSON request body')
  expect(JSON.parse(init.body)).toEqual(payload)
  expect(init.method).toBe('POST')
})

it('gets staff context without changing the configured tax rate or manual methods', async () => {
  initClient({ baseUrl: 'http://api.test', getAccessToken: () => 'token', onTokenRefreshed: () => {}, onAuthFailure: () => {} })
  const context = { vatRate: 0.05, paymentMethods: ['CASH', 'MADA'] }
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, data: context })))
  vi.stubGlobal('fetch', fetch)
  expect(await getLateSessionContext()).toEqual(context)
  const request = fetch.mock.calls[0]
  if (!request) throw new Error('Expected a fetch request')
  expect(request[0]).toBe('http://api.test/dashboard/bookings/late-entry/context')
  expect(request[1]?.method).toBeUndefined()
  expect(request[1]?.body).toBeUndefined()
})
