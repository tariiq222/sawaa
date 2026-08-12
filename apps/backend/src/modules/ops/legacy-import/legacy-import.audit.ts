import type { PrismaClient } from '@prisma/client';

export interface ProtectedCounts {
  invoices: number;
  payments: number;
}

export interface ProtectedCommsCounts {
  notifications: number;
  outboxEvents: number;
}

export interface LegacyImportAudit {
  importedAppointments: number;
  linkedAppointments: number;
  archivedAppointments: number;
  excludedAppointmentRecords: number;
  importedBookingRows: number;
  futureImportedBookings: number;
  importedBookingsWithoutHistoricalFlag: number;
  importedServiceTargets: number;
  activeImportedServices: number;
  unarchivedImportedServices: number;
  importedEmployeeTargets: number;
  activeImportedEmployees: number;
  publicImportedEmployees: number;
  intakeResponses: number;
  intakeAnswers: number;
  intakeResponsesWithoutClient: number;
  financeCounts: ProtectedCounts;
  commsCounts: ProtectedCommsCounts;
}

const CUTOVER_AT = new Date('2026-08-11T20:54:55Z');

function expectCount(label: string, actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

export function assertLegacyImportAudit(
  audit: LegacyImportAudit,
  expectedFinance: ProtectedCounts,
  expectedComms: ProtectedCommsCounts,
): void {
  expectCount('imported appointments', audit.importedAppointments, 5_022);
  expectCount('linked appointments', audit.linkedAppointments, 1);
  expectCount('archived appointments', audit.archivedAppointments, 1);
  expectCount('excluded future appointment records', audit.excludedAppointmentRecords, 0);
  expectCount('imported booking rows', audit.importedBookingRows, 5_022);
  expectCount('future imported bookings', audit.futureImportedBookings, 0);
  expectCount(
    'imported bookings without historical flag',
    audit.importedBookingsWithoutHistoricalFlag,
    0,
  );
  expectCount('imported service targets', audit.importedServiceTargets, 18);
  expectCount('active imported services', audit.activeImportedServices, 0);
  expectCount('unarchived imported services', audit.unarchivedImportedServices, 0);
  expectCount('imported employee targets', audit.importedEmployeeTargets, 18);
  expectCount('active imported employees', audit.activeImportedEmployees, 0);
  expectCount('public imported employees', audit.publicImportedEmployees, 0);
  expectCount('intake responses', audit.intakeResponses, 4_967);
  expectCount('intake answers', audit.intakeAnswers, 23_734);
  expectCount('intake responses without client', audit.intakeResponsesWithoutClient, 0);
  expectCount('invoice count changed', audit.financeCounts.invoices, expectedFinance.invoices);
  expectCount('payment count changed', audit.financeCounts.payments, expectedFinance.payments);
  expectCount(
    'notification count changed',
    audit.commsCounts.notifications,
    expectedComms.notifications,
  );
  expectCount(
    'outbox event count changed',
    audit.commsCounts.outboxEvents,
    expectedComms.outboxEvents,
  );
}

export async function collectLegacyImportAudit(
  prisma: PrismaClient,
  excludedAppointmentIds: readonly number[],
): Promise<LegacyImportAudit> {
  const importedServiceIds = [
    ...new Set(
      (
        await prisma.legacyImportRecord.findMany({
          where: { entityType: 'SERVICE', disposition: 'IMPORTED' },
          select: { targetId: true },
        })
      ).flatMap((row) => (row.targetId ? [row.targetId] : [])),
    ),
  ];
  const importedEmployeeIds = [
    ...new Set(
      (
        await prisma.legacyImportRecord.findMany({
          where: { entityType: 'EMPLOYEE', disposition: 'IMPORTED' },
          select: { targetId: true },
        })
      ).flatMap((row) => (row.targetId ? [row.targetId] : [])),
    ),
  ];
  const importedBookingIds = (
    await prisma.legacyImportRecord.findMany({
      where: { entityType: 'APPOINTMENT', disposition: 'IMPORTED' },
      select: { targetId: true },
    })
  ).flatMap((row) => (row.targetId ? [row.targetId] : []));
  const legacyFormIds = (
    await prisma.legacyImportRecord.findMany({
      where: { entityType: 'INTAKE_FORM', disposition: 'IMPORTED' },
      select: { targetId: true },
    })
  ).flatMap((row) => (row.targetId ? [row.targetId] : []));
  const intakeRows = await prisma.intakeResponse.findMany({
    where: { formId: { in: legacyFormIds } },
    select: { answers: true, clientId: true },
  });
  const [
    importedAppointments,
    linkedAppointments,
    archivedAppointments,
    excludedAppointmentRecords,
    importedBookingRows,
    futureImportedBookings,
    importedBookingsWithoutHistoricalFlag,
    activeImportedServices,
    unarchivedImportedServices,
    activeImportedEmployees,
    publicImportedEmployees,
    invoices,
    payments,
    notifications,
    outboxEvents,
  ] = await Promise.all([
    prisma.legacyImportRecord.count({ where: { entityType: 'APPOINTMENT', disposition: 'IMPORTED' } }),
    prisma.legacyImportRecord.count({ where: { entityType: 'APPOINTMENT', disposition: 'LINKED_EXISTING' } }),
    prisma.legacyImportRecord.count({ where: { entityType: 'APPOINTMENT', disposition: 'ARCHIVED_ONLY' } }),
    prisma.legacyImportRecord.count({ where: { entityType: 'APPOINTMENT', legacyId: { in: excludedAppointmentIds.map(String) } } }),
    prisma.booking.count({ where: { id: { in: importedBookingIds } } }),
    prisma.booking.count({ where: { id: { in: importedBookingIds }, scheduledAt: { gt: CUTOVER_AT } } }),
    prisma.booking.count({ where: { id: { in: importedBookingIds }, isHistoricalImport: false } }),
    prisma.service.count({ where: { id: { in: importedServiceIds }, isActive: true } }),
    prisma.service.count({ where: { id: { in: importedServiceIds }, archivedAt: null } }),
    prisma.employee.count({ where: { id: { in: importedEmployeeIds }, isActive: true } }),
    prisma.employee.count({ where: { id: { in: importedEmployeeIds }, isPublic: true } }),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.notification.count(),
    prisma.outboxEvent.count(),
  ]);
  return {
    importedAppointments,
    linkedAppointments,
    archivedAppointments,
    excludedAppointmentRecords,
    importedBookingRows,
    futureImportedBookings,
    importedBookingsWithoutHistoricalFlag,
    importedServiceTargets: importedServiceIds.length,
    activeImportedServices,
    unarchivedImportedServices,
    importedEmployeeTargets: importedEmployeeIds.length,
    activeImportedEmployees,
    publicImportedEmployees,
    intakeResponses: intakeRows.length,
    intakeAnswers: intakeRows.reduce(
      (sum, row) => sum + Object.keys(row.answers as Record<string, unknown>).length,
      0,
    ),
    intakeResponsesWithoutClient: intakeRows.filter((row) => !row.clientId).length,
    financeCounts: { invoices, payments },
    commsCounts: { notifications, outboxEvents },
  };
}
