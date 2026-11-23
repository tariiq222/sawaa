import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STATUS_LABEL_MAP } from '../lib/status-helpers';
import { BOOKING_STATUSES, type BookingStatus } from '../types/booking-enums';

/**
 * Parity guard for AC-3 of MNT-21.
 *
 * The mobile app keeps its own `BookingStatus` union today (the workspace merge
 * that would let it import the snapshot type is a separate, owner-gated stage).
 * Until then this test is the guard that was missing: it compares the local
 * union, the label map and the mapping comment against the committed OpenAPI
 * snapshot, so a backend status change fails here instead of drifting silently.
 */
const SNAPSHOT = join(__dirname, '../../backend/openapi.json');

/** Wire vocabulary: the snapshot's enum is UPPER_CASE, the app is snake_case. */
function snapshotStatuses(): string[] {
  const spec = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as {
    components: { schemas: Record<string, { enum?: string[] }> };
  };
  const schema = spec.components.schemas['BookingStatus'];
  if (!schema?.enum) throw new Error('BookingStatus enum missing from openapi.json');
  return schema.enum.map((value) => value.toLowerCase());
}

function bookingEnumsSource(): string {
  return readFileSync(join(__dirname, '../types/booking-enums.ts'), 'utf8');
}

/** The union itself: `export type BookingStatus = 'a' | 'b' | ...` */
function localUnion(): string[] {
  const source = bookingEnumsSource();
  const start = source.indexOf('export type BookingStatus');
  if (start === -1) throw new Error('BookingStatus union missing from booking-enums.ts');
  const union = source.slice(start, source.indexOf(';', start));
  return [...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]!);
}

/** The Prisma → wire table in the file header comment, BookingStatus rows only. */
function documentedMappings(): string[] {
  const source = bookingEnumsSource();
  const start = source.indexOf('Prisma BookingStatus');
  const end = source.indexOf('export type BookingType');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('BookingStatus mapping table missing from booking-enums.ts');
  }
  return source
    .slice(start, end)
    .split('\n')
    .map((line) => /^\s*\*\s+([A-Z][A-Z_]*)\s+([a-z_]+)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[2]!);
}

describe('BookingStatus parity with the OpenAPI snapshot', () => {
  it('covers exactly the statuses the backend exposes', () => {
    expect([...localUnion()].sort()).toEqual([...snapshotStatuses()].sort());
  });

  it('labels every backend status with an appointments.* key', () => {
    // Iterating the snapshot (not the map's own keys) is what catches a
    // missing label: a key absent from the map reads back as undefined.
    for (const status of snapshotStatuses()) {
      expect(STATUS_LABEL_MAP[status as BookingStatus]).toMatch(/^appointments\./);
    }
  });

  it('documents every status in the Prisma → wire table', () => {
    // Guards the drift of F-22: the header comment used to list 9 statuses
    // while the union had 10. It reads the comment block itself, so removing a
    // row fails here even though the union still compiles.
    expect([...documentedMappings()].sort()).toEqual([...snapshotStatuses()].sort());
  });

  it('keeps the runtime status list in step with the snapshot', () => {
    // BOOKING_STATUSES is what code validates against at runtime; a missing
    // entry silently normalises that status to the fallback.
    expect([...BOOKING_STATUSES].sort()).toEqual([...snapshotStatuses()].sort());
  });

  it('names the Prisma column exactly as the schema does', () => {
    // The wire column was the only guarded one, so a typo in the left column
    // ("DEPOSIT_PAYED") passed. This reads the real schema enum instead.
    const schema = readFileSync(
      join(__dirname, '../../backend/prisma/schema/bookings.prisma'),
      'utf8',
    );
    const enumBlock = /enum BookingStatus \{([^}]*)\}/.exec(schema)?.[1];
    if (!enumBlock) throw new Error('BookingStatus enum missing from bookings.prisma');
    const prismaValues = enumBlock
      .split('\n')
      .map((line) => /^\s*([A-Z][A-Z_]*)\s*$/.exec(line)?.[1])
      .filter((value): value is string => value !== undefined);

    expect(prismaValues.sort()).toEqual(
      snapshotStatuses()
        .map((wire) => wire.toUpperCase())
        .sort(),
    );
  });
});
