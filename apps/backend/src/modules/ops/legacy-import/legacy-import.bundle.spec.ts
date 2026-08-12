import {
  hashLegacyPayload,
  partitionAppointments,
  validateLegacyBundle,
} from './legacy-import.bundle';
import type { LegacyBundleV1 } from './legacy-import.types';

const validBundle: LegacyBundleV1 = {
  schemaVersion: 1,
  sourceSystem: 'booknetic',
  sourceTenant: 6,
  extractedAt: '2026-08-11T17:47:00.000Z',
  counts: {
    appointments: 2,
    customers: 1,
    staff: 1,
    services: 1,
    locations: 1,
    customData: 0,
  },
  appointments: [
    {
      id: 100,
      locationId: 1,
      serviceId: 1,
      staffId: 1,
      customerId: 1,
      startsAt: 1_691_942_400,
      endsAt: 1_691_944_200,
      status: 'approved',
      paymentMethod: 'local',
      paymentStatus: 'paid',
      paidAmount: '200.0000',
      note: null,
      createdAt: 1_691_837_783,
    },
    {
      id: 15886,
      locationId: 1,
      serviceId: 1,
      staffId: 1,
      customerId: 1,
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
      lastName: 'قديم',
      phone: '+966500000001',
      email: 'legacy@example.com',
      birthdate: null,
      notes: null,
      gender: null,
      createdAt: '2023-08-11',
    },
  ],
  staff: [
    {
      id: 1,
      name: 'معالج قديم',
      email: 'staff@example.com',
      phone: '+966500000002',
      profession: null,
      isActive: false,
    },
  ],
  services: [
    {
      id: 1,
      categoryId: 1,
      name: 'خدمة قديمة',
      price: '200.0000',
      duration: 30,
      isActive: false,
    },
  ],
  serviceCategories: [{ id: 1, name: 'تصنيف قديم' }],
  locations: [{ id: 1, name: 'الموقع القديم' }],
  forms: [],
  formInputs: [],
  formInputChoices: [],
  appointmentCustomData: [],
};

describe('legacy import bundle', () => {
  it('rejects a bundle from any tenant except 6', () => {
    expect(() =>
      validateLegacyBundle({ ...validBundle, sourceTenant: 7 }),
    ).toThrow('sourceTenant must be 6');
  });

  it('excludes appointment 15886 before a target plan can be built', () => {
    const result = partitionAppointments(
      validBundle.appointments,
      new Date('2026-08-11T20:54:55Z'),
    );

    expect(result.excluded.map((row) => row.id)).toContain(15886);
    expect(result.historical.map((row) => row.id)).not.toContain(15886);
  });

  it('produces the same sha256 for object keys in a different order', () => {
    expect(hashLegacyPayload({ b: 2, a: 1 })).toBe(
      hashLegacyPayload({ a: 1, b: 2 }),
    );
  });

  it('rejects duplicate appointment ids', () => {
    expect(() =>
      validateLegacyBundle({
        ...validBundle,
        counts: { ...validBundle.counts, appointments: 3 },
        appointments: [
          ...validBundle.appointments,
          validBundle.appointments[0]!,
        ],
      }),
    ).toThrow('duplicate appointment id 100');
  });

  it('rejects an appointment with a missing referenced customer', () => {
    expect(() =>
      validateLegacyBundle({
        ...validBundle,
        counts: { ...validBundle.counts, customers: 0 },
        customers: [],
      }),
    ).toThrow('appointment 100 references missing customer 1');
  });
});
