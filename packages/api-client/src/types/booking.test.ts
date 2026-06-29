import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOOKING_STATUSES } from './booking'

// Enum-drift gate for the hand-written api-client.
//
// packages/api-client is NOT generated, so nothing rebuilds its unions when a
// backend enum gains a value. The existing scripts/check-api-client-drift.mjs
// only covers endpoint path+method existence, NOT enum/union shape — which is
// how 'deposit_paid' (P1-15) drifted out of BookingStatus undetected.
//
// This test cross-checks the BOOKING_STATUSES tuple (the single source of truth
// for the BookingStatus union) against the committed OpenAPI snapshot's
// `BookingStatus` enum. The client uses snake_case while the backend enum is
// UPPER_CASE, so we compare on the normalized (UPPER_CASE) form.

const here = path.dirname(fileURLToPath(import.meta.url))
const SPEC_PATH = path.resolve(here, '../../../../apps/backend/openapi.json')

function specBookingStatusEnum(): string[] {
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'))
  const enumValues = spec?.components?.schemas?.BookingStatus?.enum
  if (!Array.isArray(enumValues)) {
    throw new Error(
      `BookingStatus enum not found in ${SPEC_PATH}; run 'pnpm openapi:sync' to refresh the snapshot.`,
    )
  }
  return enumValues as string[]
}

const toBackend = (s: string) => s.toUpperCase()

describe('BookingStatus enum-drift gate (api-client vs OpenAPI)', () => {
  it('includes deposit_paid (the value that drifted in P1-15)', () => {
    expect(BOOKING_STATUSES).toContain('deposit_paid')
  })

  it('matches the backend BookingStatus enum value-for-value', () => {
    const clientValues = [...BOOKING_STATUSES].map(toBackend).sort()
    const backendValues = [...specBookingStatusEnum()].sort()
    expect(clientValues).toEqual(backendValues)
  })

  it('has no missing or extra values relative to the spec', () => {
    const client = new Set(BOOKING_STATUSES.map(toBackend))
    const backend = new Set(specBookingStatusEnum())
    const missing = [...backend].filter((v) => !client.has(v))
    const extra = [...client].filter((v) => !backend.has(v))
    expect({ missing, extra }).toEqual({ missing: [], extra: [] })
  })
})
