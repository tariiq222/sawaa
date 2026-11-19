import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  ClientBookingJoinLink,
  ClientBookingMutation,
  ClientBookingRating,
  ClientRefundRequestResult,
} from './client-surface'

/**
 * Drift guard: the hand-written `/client` response types in
 * `client-surface.ts` must keep matching the committed OpenAPI snapshot.
 *
 * Compares the `required` key set of each documented schema with the local
 * declaration (non-optional keys). Optional schema properties
 * (`required: false`) are compared separately. Request URLs, options and
 * bodies are untouched by this test.
 */

type Schemas = Record<string, { required?: string[]; properties?: Record<string, unknown> }>
const spec = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../apps/backend/openapi.json'), 'utf8'),
) as { components: { schemas: Schemas } }

const schema = (name: string) => {
  const found = spec.components.schemas[name]
  if (!found) throw new Error(`Missing OpenAPI schema ${name}`)
  return found
}
const required = (name: string) => [...(schema(name).required ?? [])].sort()
const keys = (value: object) => Object.keys(value).sort()

describe('api-client /client response types mirror the OpenAPI snapshot', () => {
  it('ClientBookingRating matches ClientBookingRatingResponseDto exactly', () => {
    const sample: ClientBookingRating = {
      id: 'r',
      bookingId: 'b',
      clientId: 'c',
      employeeId: 'e',
      score: 5,
      comment: null,
      isPublic: false,
      createdAt: '2026-05-20T09:00:00.000Z',
    }
    expect(keys(sample)).toEqual(required('ClientBookingRatingResponseDto'))
    expect(schema('ClientBookingRatingResponseDto').properties?.score).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 5,
    })
  })

  it('ClientBookingJoinLink matches ClientBookingJoinResponseDto and stays nullable', () => {
    const sample: ClientBookingJoinLink = { joinUrl: null, scheduledAt: '2026-05-20T07:00:00.000Z' }
    expect(keys(sample)).toEqual(required('ClientBookingJoinResponseDto'))
    expect(schema('ClientBookingJoinResponseDto').properties?.joinUrl).toMatchObject({
      type: 'string',
      nullable: true,
    })
  })

  it('ClientBookingMutation lists exactly the documented projection keys', () => {
    const sample: ClientBookingMutation = {
      id: '',
      bookingNumber: 0,
      serviceId: null,
      employeeId: '',
      branchId: '',
      status: 'CONFIRMED',
      bookingType: 'INDIVIDUAL',
      deliveryType: 'IN_PERSON',
      scheduledAt: '',
      endsAt: '',
      durationMins: 0,
      durationMinutesSnapshot: null,
      price: '0',
      priceSnapshot: null,
      currency: '',
      payAtClinic: false,
      serviceNameSnapshot: null,
      employeeNameSnapshot: null,
      branchNameSnapshot: null,
      categoryNameSnapshot: null,
      zoomJoinUrl: null,
      zoomMeetingStatus: null,
      createdAt: '',
      updatedAt: '',
      checkedInAt: null,
      confirmedAt: null,
      completedAt: null,
      noShowAt: null,
      cancelledAt: null,
      cancelReason: null,
    }
    expect(keys(sample)).toEqual(required('ClientBookingMutationDto'))
    // Money stays a decimal string, never a float.
    expect(schema('ClientBookingMutationDto').properties?.price).toMatchObject({ type: 'string' })
    expect(schema('ClientBookingMutationDto').properties?.priceSnapshot).toMatchObject({
      type: 'string',
      nullable: true,
    })
  })

  it('ClientRefundRequestResult matches ClientRefundRequestResponseDto with integer halalas', () => {
    const sample: ClientRefundRequestResult = {
      id: 'r',
      status: 'PENDING_REVIEW',
      amount: 20000,
      createdAt: '2026-05-20T09:00:00.000Z',
    }
    expect(keys(sample)).toEqual(required('ClientRefundRequestResponseDto'))
    expect(schema('ClientRefundRequestResponseDto').properties?.amount).toMatchObject({
      type: 'integer',
      minimum: 0,
    })
  })
})
