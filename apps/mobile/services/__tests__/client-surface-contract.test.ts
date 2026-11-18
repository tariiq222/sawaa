import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ClientBookingJoinLink, ClientBookingRating } from '../client/bookings';
import type { ClientPackageBookingResult } from '../client/packages';
import type { ClientInvoiceListItem, ClientRefundRequestResult } from '../client/payments';
import type { ClientNotificationFcmToken } from '../notifications';

/**
 * Drift guard for the hand-maintained types that mirror the authenticated
 * `/client` surface (MNT-08). The mobile app is outside the root pnpm
 * workspace and has no generated-types artifact, so these declarations are
 * written by hand. This test reads the committed OpenAPI snapshot and fails
 * when the documented `required` keys stop matching the local declarations.
 *
 * It compares KEY SETS only. Runtime request URLs, params, bodies, headers and
 * returned objects are not touched by this test.
 */

type Schemas = Record<string, { required?: string[]; properties?: Record<string, unknown> }>;

const spec = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../apps/backend/openapi.json'), 'utf8'),
) as { components: { schemas: Schemas } };

const schema = (name: string) => {
  const found = spec.components.schemas[name];
  if (!found) throw new Error(`Missing OpenAPI schema ${name}`);
  return found;
};

const documentedRequired = (name: string): string[] => [...(schema(name).required ?? [])].sort();
const localKeys = (value: object): string[] => Object.keys(value).sort();

describe('mobile /client types mirror the OpenAPI snapshot', () => {
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
    };
    expect(localKeys(sample)).toEqual(documentedRequired('ClientBookingRatingResponseDto'));
    expect(schema('ClientBookingRatingResponseDto').properties?.score).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 5,
    });
  });

  it('ClientBookingJoinLink matches ClientBookingJoinResponseDto and keeps joinUrl nullable', () => {
    const sample: ClientBookingJoinLink = { joinUrl: null, scheduledAt: '2026-05-20T07:00:00.000Z' };
    expect(localKeys(sample)).toEqual(documentedRequired('ClientBookingJoinResponseDto'));
    expect(schema('ClientBookingJoinResponseDto').properties?.joinUrl).toMatchObject({
      type: 'string',
      nullable: true,
    });
  });

  it('ClientPackageBookingResult is a documented subset of ClientBookingRecordDto', () => {
    const sample: ClientPackageBookingResult = { id: 'b', status: 'CONFIRMED', packageCreditId: null };
    const documented = new Set(documentedRequired('ClientBookingRecordDto'));
    for (const key of localKeys(sample)) expect(documented).toContain(key);
  });

  it('ClientInvoiceListItem lists exactly the documented invoice list row keys', () => {
    const sample: ClientInvoiceListItem = {
      id: 'i',
      number: 1,
      bookingId: null,
      serviceName: '',
      scheduledAt: null,
      subtotal: 0,
      discountAmt: 0,
      vatRate: 0,
      vatAmt: 0,
      total: 0,
      refundedAmount: 0,
      currency: 'SAR',
      status: 'PAID',
      paymentStatus: null,
      issuedAt: null,
      paidAt: null,
      createdAt: '2026-05-20T09:00:00.000Z',
    };
    expect(localKeys(sample)).toEqual(documentedRequired('ClientInvoiceListItemDto'));
    expect(schema('ClientInvoiceListItemDto').properties?.outstandingBalance).toBeUndefined();
  });

  it('ClientRefundRequestResult matches ClientRefundRequestResponseDto with integer halalas', () => {
    const sample: ClientRefundRequestResult = {
      id: 'r',
      status: 'PENDING_REVIEW',
      amount: 20000,
      createdAt: '2026-05-20T09:00:00.000Z',
    };
    expect(localKeys(sample)).toEqual(documentedRequired('ClientRefundRequestResponseDto'));
    expect(schema('ClientRefundRequestResponseDto').properties?.amount).toMatchObject({
      type: 'integer',
      minimum: 0,
    });
  });

  it('ClientNotificationFcmToken matches ClientNotificationFcmTokenDto exactly', () => {
    const sample: ClientNotificationFcmToken = {
      id: 't',
      clientId: 'c',
      token: 'placeholder',
      platform: 'ios',
      lastSeenAt: '2026-05-20T09:00:00.000Z',
      createdAt: '2026-05-20T09:00:00.000Z',
    };
    expect(localKeys(sample)).toEqual(documentedRequired('ClientNotificationFcmTokenDto'));
  });
});
