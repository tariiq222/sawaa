import { assertLegacyImportAudit } from './legacy-import.audit';

describe('legacy import audit', () => {
  const valid = {
    importedAppointments: 5_022,
    linkedAppointments: 1,
    archivedAppointments: 1,
    excludedAppointmentRecords: 0,
    importedBookingRows: 5_022,
    futureImportedBookings: 0,
    importedBookingsWithoutHistoricalFlag: 0,
    importedServiceTargets: 18,
    activeImportedServices: 0,
    unarchivedImportedServices: 0,
    importedEmployeeTargets: 18,
    activeImportedEmployees: 0,
    publicImportedEmployees: 0,
    intakeResponses: 4_967,
    intakeAnswers: 23_734,
    intakeResponsesWithoutClient: 0,
    financeCounts: { invoices: 30, payments: 29 },
    commsCounts: { notifications: 671, outboxEvents: 72 },
  };

  it('accepts the frozen production import invariants', () => {
    expect(() =>
      assertLegacyImportAudit(valid, valid.financeCounts, valid.commsCounts),
    ).not.toThrow();
  });

  it('fails when an excluded future appointment has any import record', () => {
    expect(() =>
      assertLegacyImportAudit(
        { ...valid, excludedAppointmentRecords: 1 },
        valid.financeCounts,
        valid.commsCounts,
      ),
    ).toThrow('excluded future appointment records');
  });

  it('fails when pre-existing finance counts changed', () => {
    expect(() =>
      assertLegacyImportAudit(valid, { invoices: 31, payments: 29 }, valid.commsCounts),
    ).toThrow('invoice count changed');
  });
});
