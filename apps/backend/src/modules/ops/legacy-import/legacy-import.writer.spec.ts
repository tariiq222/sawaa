import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { applyLegacyImportPlan } from './legacy-import.writer';
import type { LegacyImportPlan } from './legacy-import.planner';
import type { LegacyBundleV1 } from './legacy-import.types';

const databaseUrl = process.env.LEGACY_IMPORT_TEST_DATABASE_URL;
const maybeDescribe = databaseUrl ? describe : describe.skip;

maybeDescribe('legacy import writer', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl! }),
  });

  afterAll(async () => prisma.$disconnect());

  it('adds rows without changing finance, comms, or outbox counts', async () => {
    const suffix = Date.now().toString();
    const clientKey = `legacy-client:${suffix}`;
    const employeeKey = `legacy-staff:${suffix}`;
    const plan = {
      cutoverAt: new Date('2026-08-11T20:54:55Z'),
      excludedAppointmentIds: [15886],
      historicalServices: [
        {
          legacyId: 900001,
          nameAr: `خدمة اختبار ${suffix} — نظام قديم`,
          originalName: `خدمة اختبار ${suffix}`,
          originalCategoryName: 'تصنيف قديم',
          durationMins: 30,
          priceHalalas: 20_000,
        },
      ],
      employeeMatches: {
        legacyToEmployee: new Map([[900001, { kind: 'new', key: employeeKey }]]),
        newHistoricalEmployees: [
          {
            key: employeeKey,
            legacyIds: [900001],
            name: `معالج اختبار ${suffix}`,
            email: null,
            phone: null,
            profession: null,
          },
        ],
        matchedCurrentEmployeeIds: [],
      },
      clientMatches: {
        legacyToClient: new Map([[900001, { kind: 'new', key: clientKey }]]),
        newClients: [
          {
            key: clientKey,
            legacyIds: [900001],
            canonical: {
              id: 900001,
              firstName: 'عميل',
              lastName: 'اختبار',
              phone: null,
              email: null,
              birthdate: null,
              notes: null,
              gender: null,
              createdAt: '2023-01-01',
            },
            name: `عميل اختبار ${suffix}`,
            phone: null,
            email: null,
          },
        ],
        matchedCurrentClientIds: [],
      },
      newHistoricalEmployees: [],
      matchedCurrentEmployeeIds: [],
      newBookings: [
        {
          legacyAppointmentId: 900001,
          bookingNumber: 1_900_001,
          branchId: 'c2a17208-6528-48d3-ae33-52bd98842239',
          client: { kind: 'new', key: clientKey },
          employee: { kind: 'new', key: employeeKey },
          legacyServiceId: 900001,
          status: 'EXPIRED',
          deliveryType: 'IN_PERSON',
          scheduledAt: new Date('2024-01-01T08:00:00Z'),
          endsAt: new Date('2024-01-01T08:30:00Z'),
          durationMins: 30,
          priceHalalas: 20_000,
          notes: null,
          branchNameSnapshot: 'الفرع القديم',
          employeeNameSnapshot: `معالج اختبار ${suffix}`,
          serviceNameSnapshot: `خدمة اختبار ${suffix}`,
          categoryNameSnapshot: 'تصنيف قديم',
          sourceStatus: 'pending',
          sourcePaymentMethod: 'local',
          sourcePaymentStatus: 'not_paid',
          sourcePaidAmount: '0.0000',
        },
      ],
      appointmentDispositions: new Map([[900001, { kind: 'IMPORTED' }]]),
    } satisfies LegacyImportPlan;
    const bundle = {
      schemaVersion: 1,
      sourceSystem: 'booknetic',
      sourceTenant: 6,
      extractedAt: '2026-08-11T17:47:00Z',
      counts: {
        appointments: 0,
        customers: 0,
        staff: 0,
        services: 0,
        locations: 0,
        customData: 0,
      },
      appointments: [],
      customers: [],
      staff: [],
      services: [],
      serviceCategories: [],
      locations: [],
      forms: [],
      formInputs: [],
      formInputChoices: [],
      appointmentCustomData: [],
    } satisfies LegacyBundleV1;
    const before = await Promise.all([
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.notification.count(),
      prisma.outboxEvent.count(),
    ]);

    const report = await applyLegacyImportPlan(prisma, bundle, plan);

    const after = await Promise.all([
      prisma.invoice.count(),
      prisma.payment.count(),
      prisma.notification.count(),
      prisma.outboxEvent.count(),
    ]);
    expect(report.insertedBookings).toBe(1);
    expect(after).toEqual(before);
    expect(await prisma.booking.count({ where: { bookingNumber: 1_900_001 } })).toBe(1);
    expect(
      await prisma.legacyImportRecord.count({
        where: { entityType: 'APPOINTMENT', legacyId: '15886' },
      }),
    ).toBe(0);
  });
});
