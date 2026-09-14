import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import * as families from '../package-families'

beforeEach(() => {
  initClient({ baseUrl: 'http://api.test/api/v1', getAccessToken: () => null, onAuthFailure: vi.fn(), onTokenRefreshed: vi.fn() })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'purchase-1' }, success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
it('sends the selected offer and family identity with the same idempotency key', async () => {
  const input = { packageId: 'offer-9', packageFamilyId: 'family-1', branchId: 'branch-1', idempotencyKey: 'attempt-1' }
  await families.initPackagePurchase(input)
  const [url, options] = vi.mocked(fetch).mock.calls[0]!
  expect(url).toBe('http://api.test/api/v1/public/payments/package-purchases/init')
  expect(options?.credentials).toBe('include')
  expect(JSON.parse(String(options?.body))).toEqual(input)
})
it('reads own balances without a caller-supplied client identity', async () => {
  await families.listMyPackagePurchases()
  const [url, options] = vi.mocked(fetch).mock.calls[0]!
  expect(url).toBe('http://api.test/api/v1/public/me/packages/purchases')
  expect(options?.credentials).toBe('include')
})
it('submits the exact credit and time without inventing a price or client identity', async () => {
  const input = { creditId: 'credit-1', branchId: 'branch-1', scheduledAt: '2026-12-31T09:00:00Z' }
  await families.bookMyPackageCredit(input)
  const [url, options] = vi.mocked(fetch).mock.calls[0]!
  expect(url).toBe('http://api.test/api/v1/public/me/packages/book')
  expect(JSON.parse(String(options?.body))).toEqual(input)
  expect(options?.credentials).toBe('include')
})
it('encodes public detail identity as a single path segment', async () => {
  await families.getPublicPackageFamily('family/one')
  expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('http://api.test/api/v1/public/package-families/family%2Fone')
})
