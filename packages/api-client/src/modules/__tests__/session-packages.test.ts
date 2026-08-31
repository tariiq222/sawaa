import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initClient } from '../../client'
import type {
  CreateSessionPackagePayload,
  UpdateSessionPackagePayload,
} from '../../types/session-package'
import {
  archiveSessionPackage,
  createSessionPackage,
  getSessionPackage,
  listSessionPackages,
  updateSessionPackage,
} from '../session-packages'

let storedAccess = 'access.jwt'
let onTokenRefreshed = vi.fn()
let onAuthFailure = vi.fn()

beforeEach(() => {
  storedAccess = 'access.jwt'
  onTokenRefreshed = vi.fn()
  onAuthFailure = vi.fn()
  initClient({
    baseUrl: 'http://api.test',
    getAccessToken: () => storedAccess,
    onTokenRefreshed,
    onAuthFailure,
  })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function okJson(body: unknown): Response {
  return new Response(JSON.stringify({ success: true, data: body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function lastRequest() {
  const call = vi.mocked(fetch).mock.calls.at(-1)
  if (!call) throw new Error('Expected fetch to be called')
  return call
}

function authHeader(init: RequestInit | undefined): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.Authorization
}

const packageDetail = {
  id: 'pkg-1',
  nameAr: 'باقة الأسرة',
  nameEn: 'Family package',
  discountType: 'PERCENTAGE',
  discountValue: 15,
  isActive: true,
  isPublic: true,
  price: { subtotal: 100000, discount: 15000, total: 85000 },
}

const createPayload: CreateSessionPackagePayload = {
  nameAr: 'باقة الأسرة',
  nameEn: 'Family package',
  discountType: 'PERCENTAGE',
  discountValue: 15,
  isActive: true,
  isPublic: false,
  items: [
    {
      serviceId: 'svc-1',
      employeeId: 'emp-1',
      durationOptionId: 'dur-1',
      paidQuantity: 5,
    },
  ],
}

const updatePayload: UpdateSessionPackagePayload = {
  nameEn: 'Updated family package',
  isPublic: true,
  discountValue: 20,
}

describe('session-packages module', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation(async () => okJson(packageDetail))
  })

  it('lists packages with every query dimension, encoding search and keeping false', async () => {
    await listSessionPackages({
      page: 2,
      limit: 25,
      search: 'family & couples',
      isActive: false,
      isPublic: true,
    })

    const [url, init] = lastRequest()
    expect(url).toBe(
      'http://api.test/dashboard/organization/packages?page=2&limit=25&search=family+%26+couples&isActive=false&isPublic=true',
    )
    expect(url).toContain('isActive=false')
    expect(url).not.toMatch(/\?$/)
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('omits the query string entirely when no params are provided', async () => {
    await listSessionPackages()

    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/organization/packages',
    )
  })

  it('omits undefined optional list filters without a trailing ?', async () => {
    await listSessionPackages({ page: 3, search: 'couples' })

    expect(lastRequest()[0]).toBe(
      'http://api.test/dashboard/organization/packages?page=3&search=couples',
    )
  })

  it('GETs /dashboard/organization/packages/:id with the bearer token', async () => {
    await getSessionPackage('pkg-1')

    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/organization/packages/pkg-1')
    expect(init?.method).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })

  it('POSTs a new session package and serializes the payload', async () => {
    await createSessionPackage(createPayload)

    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/organization/packages')
    expect(init?.method).toBe('POST')
    expect(authHeader(init)).toBe('Bearer access.jwt')
    expect(JSON.parse(init?.body as string)).toEqual(createPayload)
  })

  it('PATCHes a session package and serializes the payload', async () => {
    await updateSessionPackage('pkg-1', updatePayload)

    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/organization/packages/pkg-1')
    expect(init?.method).toBe('PATCH')
    expect(authHeader(init)).toBe('Bearer access.jwt')
    expect(JSON.parse(init?.body as string)).toEqual(updatePayload)
  })

  it('DELETEs a session package and treats a 204 empty body as success', async () => {
    vi.mocked(fetch).mockReset()
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(archiveSessionPackage('pkg-1')).resolves.toBeUndefined()

    const [url, init] = lastRequest()
    expect(url).toBe('http://api.test/dashboard/organization/packages/pkg-1')
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
    expect(authHeader(init)).toBe('Bearer access.jwt')
  })
})
