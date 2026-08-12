import { serializeSafeLegacyImportReport } from './legacy-import.report';

describe('legacy import report', () => {
  it('serializes aggregate counts without fixture PII', () => {
    const serialized = serializeSafeLegacyImportReport({
      mode: 'dry-run',
      bundleSha256: 'a'.repeat(64),
      targetDatabase: 'sawaa',
      sourceAppointments: 5_035,
      excludedFuture: 11,
      plannedBookings: 5_022,
      insertedBookings: 0,
      technicalExceptions: [15747, 15834],
    });

    expect(serialized).toContain('"sourceAppointments": 5035');
    expect(serialized).not.toContain('0501234567');
    expect(serialized).not.toContain('secret@example.com');
    expect(serialized).not.toContain('إجابة حساسة');
  });
});
