import { assertLegacyImportAudit, collectLegacyImportAudit } from './legacy-import.audit';

describe('legacy import audit', () => {
  it('counts current and superseded answers separately without excluding retained history', async () => {
    const count = () => ({ count: jest.fn().mockResolvedValue(0) });
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ historyInstalled: true }]),
      legacyImportRecord: {
        ...count(),
        findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(
          where.entityType === 'INTAKE_FORM' ? [{ targetId: 'form-1' }] : [],
        )),
      },
      intakeResponse: { findMany: jest.fn().mockResolvedValue([
        { answers: { field: 'current' }, clientId: 'client-1', supersededAt: null },
        { answers: { field: 'retained' }, clientId: 'client-1', supersededAt: new Date() },
      ]) },
      intakeResponseRevision: { count: jest.fn().mockResolvedValue(1) },
      booking: count(), service: count(), employee: count(), invoice: count(),
      payment: count(), notification: count(), outboxEvent: count(),
    };
    const audit = await collectLegacyImportAudit(prisma as never, []);
    expect(audit).toMatchObject({
      intakeResponses: 2, intakeAnswers: 2,
      intakeCurrentResponses: 1, intakeSupersededResponses: 1, intakeRevisionSnapshots: 1,
    });
    expect(prisma.intakeResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { formId: { in: ['form-1'] } },
    }));
  });

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
