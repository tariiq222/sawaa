import { describe, expect, it } from 'vitest'
import { buildQueryString } from './api'

// The EXPORTED buildQueryString (from src/types/api.ts). It differs from the
// private copies in src/modules/* — those use `URLSearchParams.append` and
// only skip null/undefined; the exported one uses `set` and additionally
// skips empty strings. We lock the exported semantics here so any change
// to the public API is caught.
describe('buildQueryString (exported from types/api)', () => {
  it('returns an empty string when no params are provided', () => {
    expect(buildQueryString({})).toBe('')
  })

  it('prefixes the result with "?" when at least one value is present', () => {
    expect(buildQueryString({ page: 1 })).toBe('?page=1')
  })

  it('encodes keys and stringifies values', () => {
    expect(buildQueryString({ page: 2, limit: 25, search: 'hello world' })).toBe(
      '?page=2&limit=25&search=hello+world',
    )
  })

  it('skips undefined, null, and empty-string values (the public contract)', () => {
    expect(
      buildQueryString({
        page: 1,
        search: undefined,
        status: null,
        note: '',
        dateFrom: '2026-01-01',
      }),
    ).toBe('?page=1&dateFrom=2026-01-01')
  })

  it('keeps falsy values that are not undefined/null/empty-string (0, false)', () => {
    expect(buildQueryString({ page: 0, active: false })).toBe('?page=0&active=false')
  })

  it('converts non-string primitives via String()', () => {
    expect(buildQueryString({ total: 42n, ok: true, items: 0 })).toBe(
      '?total=42&ok=true&items=0',
    )
  })
})
