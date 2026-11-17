import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { EmployeeMeetingStart, EmployeeBookingPage } from '../employee/bookings';

/**
 * Drift guard for the mobile app's hand-maintained types that mirror the mobile
 * API (MNT-08). The mobile app is outside the root pnpm workspace and has no
 * generated-types artifact, so these types are declared by hand. This test
 * reads the committed OpenAPI snapshot and fails when the documented `required`
 * keys stop matching the local declarations.
 *
 * It compares KEY SETS only, and only for types whose backing endpoint is a
 * `mobile/employee` route:
 *   - `EmployeeMeetingStart` ← GET /mobile/employee/bookings/{id}/start-meeting
 *   - `EmployeeBookingPage`   ← GET /mobile/employee/bookings
 *
 * The client booking types in `services/client/bookings.ts` are NOT asserted
 * here: that service calls the shared `/client/bookings` website surface, whose
 * controllers are outside this unit's scope. Runtime request URLs, params and
 * bodies are not touched by this test.
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

describe('mobile employee API types mirror the OpenAPI snapshot', () => {
  it('EmployeeMeetingStart matches MobileEmployeeMeetingStartDto exactly', () => {
    const sample: EmployeeMeetingStart = {
      bookingId: 'b',
      scheduledAt: '2026-05-20T07:00:00.000Z',
      durationMins: 60,
      meetingStatus: null,
      startUrl: null,
    };
    expect(localKeys(sample)).toEqual(documentedRequired('MobileEmployeeMeetingStartDto'));
    // startUrl is nullable on the wire; the local type must allow null.
    expect(schema('MobileEmployeeMeetingStartDto').properties?.startUrl).toMatchObject({ nullable: true });
  });

  it('the employee booking page wraps rows in { items, meta }', () => {
    type Page = EmployeeBookingPage;
    const sample: Pick<Page, 'items' | 'meta'> = {
      items: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
    };
    expect(localKeys(sample)).toEqual(documentedRequired('MobileEmployeeBookingListResponseDto'));
    expect(documentedRequired('PaginatedBookingRowsDto')).toEqual(['items', 'meta']);
  });
});
