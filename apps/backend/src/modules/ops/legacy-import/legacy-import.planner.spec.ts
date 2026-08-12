import {
  buildLegacyImportPlan,
  matchLegacyClients,
  matchLegacyEmployees,
  type TargetSnapshot,
} from './legacy-import.planner';
import type { LegacyBundleV1 } from './legacy-import.types';

const scheduledAt = 1_785_000_000;
const endsAt = scheduledAt + 1_800;

const bundle: LegacyBundleV1 = {
  schemaVersion: 1,
  sourceSystem: 'booknetic',
  sourceTenant: 6,
  extractedAt: '2026-08-11T17:47:00.000Z',
  counts: {
    appointments: 3,
    customers: 2,
    staff: 1,
    services: 1,
    locations: 1,
    customData: 0,
  },
  appointments: [
    {
      id: 15834,
      locationId: 1,
      serviceId: 78,
      staffId: 6,
      customerId: 1,
      startsAt: scheduledAt,
      endsAt,
      status: 'approved',
      paymentMethod: 'local',
      paymentStatus: 'paid',
      paidAmount: '200.0000',
      note: null,
      createdAt: scheduledAt - 100,
    },
    {
      id: 15747,
      locationId: 1,
      serviceId: 78,
      staffId: 6,
      customerId: 2,
      startsAt: scheduledAt,
      endsAt,
      status: 'approved',
      paymentMethod: 'local',
      paymentStatus: 'paid',
      paidAmount: '200.0000',
      note: null,
      createdAt: scheduledAt - 200,
    },
    {
      id: 15886,
      locationId: 1,
      serviceId: 78,
      staffId: 6,
      customerId: 2,
      startsAt: 1_786_500_000,
      endsAt: 1_786_501_800,
      status: 'pending',
      paymentMethod: 'local',
      paymentStatus: 'not_paid',
      paidAmount: '0.0000',
      note: null,
      createdAt: 1_786_400_000,
    },
  ],
  customers: [
    {
      id: 1,
      firstName: 'عميل',
      lastName: 'حالي',
      phone: '0501234567',
      email: null,
      birthdate: null,
      notes: null,
      gender: null,
      createdAt: '2023-08-11',
    },
    {
      id: 2,
      firstName: 'عميل',
      lastName: 'قديم',
      phone: '0501234568',
      email: null,
      birthdate: null,
      notes: null,
      gender: null,
      createdAt: '2023-08-12',
    },
  ],
  staff: [
    {
      id: 6,
      name: 'أ.خالد المحمد',
      email: null,
      phone: '0501234569',
      profession: 'أخصائي نفسي',
      isActive: false,
    },
  ],
  services: [
    {
      id: 78,
      categoryId: 5,
      name: 'استشارة',
      price: '200.0000',
      duration: 30,
      isActive: false,
    },
  ],
  serviceCategories: [{ id: 5, name: 'استشارات' }],
  locations: [{ id: 1, name: 'الفرع القديم' }],
  forms: [],
  formInputs: [],
  formInputChoices: [],
  appointmentCustomData: [],
};

const target: TargetSnapshot = {
  mainBranch: { id: 'branch-main', nameAr: 'عيادات سواء' },
  clients: [
    {
      id: 'client-current',
      name: 'عميل حالي',
      phone: '+966501234567',
      email: null,
      notes: 'do not overwrite',
    },
  ],
  employees: [
    {
      id: 'employee-current',
      name: 'أ.خالد المحمد',
      phone: '+966501234569',
      email: null,
      isActive: true,
      isPublic: true,
    },
  ],
  bookings: [
    {
      id: 'existing-no-show',
      clientId: 'client-current',
      employeeId: 'employee-current',
      bookingNumber: 52,
      scheduledAt: new Date(scheduledAt * 1_000),
      endsAt: new Date(endsAt * 1_000),
      status: 'NO_SHOW',
    },
  ],
  importRecords: [],
};

describe('legacy import planner', () => {
  it('links an exact booking, archives a conflicting client, and omits future ids', () => {
    const plan = buildLegacyImportPlan(
      bundle,
      target,
      new Date('2026-08-11T20:54:55Z'),
      { enforceProductionCounts: false },
    );

    expect(plan.excludedAppointmentIds).toEqual([15886]);
    expect(plan.appointmentDispositions.get(15834)).toEqual({
      kind: 'LINKED_EXISTING',
      targetBookingId: 'existing-no-show',
    });
    expect(plan.appointmentDispositions.get(15747)).toEqual({
      kind: 'ARCHIVED_ONLY',
      reason: 'EMPLOYEE_TIME_OVERLAP',
    });
    expect(plan.appointmentDispositions.has(15886)).toBe(false);
    expect(plan.newBookings).toHaveLength(0);
  });

  it('merges the two known Dr Majed source profiles into one historical employee', () => {
    const matches = matchLegacyEmployees(
      [
        {
          id: 141,
          name: 'د.ماجد الحربي',
          email: 'one@example.com',
          phone: null,
          profession: null,
          isActive: false,
        },
        {
          id: 155,
          name: 'د. ماجد الحربي.',
          email: 'two@example.com',
          phone: null,
          profession: null,
          isActive: false,
        },
      ],
      [],
      new Map([
        [141, 5],
        [155, 2],
      ]),
    );

    expect(matches.newHistoricalEmployees).toHaveLength(1);
    expect(matches.newHistoricalEmployees[0]?.legacyIds).toEqual([141, 155]);
    expect(matches.newHistoricalEmployees[0]?.name).toBe('د.ماجد الحربي');
  });

  it('fails instead of choosing between two current employees with one phone', () => {
    expect(() =>
      matchLegacyEmployees(
        bundle.staff,
        [
          ...target.employees,
          { ...target.employees[0]!, id: 'employee-duplicate' },
        ],
        new Map([[6, 3]]),
      ),
    ).toThrow('ambiguous current employee phone');
  });

  it('fails before writing when a phone-first client would collide by email', () => {
    expect(() =>
      matchLegacyClients(
        [
          {
            id: 90,
            firstName: 'عميل',
            lastName: 'قديم',
            phone: '0509999999',
            email: 'current@example.com',
            birthdate: null,
            notes: null,
            gender: null,
            createdAt: null,
          },
        ],
        [
          {
            id: 'client-current-email',
            name: 'عميل حالي',
            phone: '+966501111111',
            email: 'current@example.com',
            notes: null,
          },
        ],
        new Map([[90, 1]]),
      ),
    ).toThrow('client email collision');
  });

  it('keeps imported appointment dispositions stable on a second plan', () => {
    const secondTarget: TargetSnapshot = {
      ...target,
      employees: [
        ...target.employees,
        {
          id: 'imported-employee',
          name: 'معالج تاريخي',
          phone: '+966500000099',
          email: 'imported@example.com',
          isActive: false,
          isPublic: false,
        },
      ],
      clients: [
        ...target.clients,
        {
          id: 'imported-client',
          name: 'عميل تاريخي',
          phone: '+966500000098',
          email: null,
          notes: null,
        },
      ],
      bookings: [
        ...target.bookings,
        {
          id: 'imported-booking',
          clientId: 'imported-client',
          employeeId: 'employee-current',
          bookingNumber: 1_015_000,
          scheduledAt: new Date('2024-01-01T08:00:00Z'),
          endsAt: new Date('2024-01-01T08:30:00Z'),
          status: 'EXPIRED',
        },
      ],
      importRecords: [
        {
          entityType: 'EMPLOYEE',
          legacyId: '900001',
          targetType: 'Employee',
          targetId: 'imported-employee',
          disposition: 'IMPORTED',
          payloadHash: 'hash-employee',
        },
        {
          entityType: 'CLIENT',
          legacyId: '900001',
          targetType: 'Client',
          targetId: 'imported-client',
          disposition: 'IMPORTED',
          payloadHash: 'hash-client',
        },
        {
          entityType: 'APPOINTMENT',
          legacyId: '15000',
          targetType: 'Booking',
          targetId: 'imported-booking',
          disposition: 'IMPORTED',
          payloadHash: 'hash-imported',
        },
        {
          entityType: 'APPOINTMENT',
          legacyId: '15834',
          targetType: 'Booking',
          targetId: 'existing-no-show',
          disposition: 'LINKED_EXISTING',
          payloadHash: 'hash-linked',
        },
        {
          entityType: 'APPOINTMENT',
          legacyId: '15747',
          targetType: null,
          targetId: null,
          disposition: 'ARCHIVED_ONLY',
          payloadHash: 'hash-archived',
        },
      ],
    };

    const plan = buildLegacyImportPlan(
      bundle,
      secondTarget,
      new Date('2026-08-11T20:54:55Z'),
      { enforceProductionCounts: false },
    );

    expect(plan.appointmentDispositions.get(15834)).toEqual({
      kind: 'LINKED_EXISTING',
      targetBookingId: 'existing-no-show',
    });
    expect(plan.appointmentDispositions.get(15747)).toEqual({
      kind: 'ARCHIVED_ONLY',
      reason: 'EMPLOYEE_TIME_OVERLAP',
    });
  });
});
