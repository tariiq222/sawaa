import { BadRequestException } from '@nestjs/common';
import { validateBookingTargetEligibility } from './booking-target-eligibility.helper';

const SERVICE_ID = 'service-1';
const EMPLOYEE_ID = 'employee-1';
const LINK_ID = 'employee-service-1';
const DURATION_ID = 'duration-1';
type EmployeeServiceOptionRow = { durationOverride: number | null };

function buildDb(overrides: Record<string, unknown> = {}) {
  const db = {
    employeeService: {
      findUnique: jest.fn().mockResolvedValue({
        id: LINK_ID,
        employeeId: EMPLOYEE_ID,
        serviceId: SERVICE_ID,
        isActive: true,
        disabledDeliveryTypes: [],
        useCustomPricing: false,
      }),
    },
    serviceDurationOption: {
      findFirst: jest.fn().mockResolvedValue({
        id: DURATION_ID,
        serviceId: SERVICE_ID,
        employeeServiceId: null,
        deliveryType: 'IN_PERSON',
        durationMins: 60,
        isActive: true,
      }),
    },
    serviceBookingConfig: {
      findMany: jest.fn().mockResolvedValue([{ deliveryType: 'IN_PERSON' }]),
    },
    employeeServiceOption: {
      findFirst: jest.fn<Promise<EmployeeServiceOptionRow | null>, []>().mockResolvedValue(null),
    },
    ...overrides,
  };
  return db;
}

describe('validateBookingTargetEligibility', () => {
  it('resolves omitted delivery from the selected duration before matching it', async () => {
    const db = buildDb({
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue({
          id: DURATION_ID,
          serviceId: SERVICE_ID,
          employeeServiceId: null,
          deliveryType: 'ONLINE',
          durationMins: 45,
          isActive: true,
        }),
      },
      serviceBookingConfig: {
        findMany: jest.fn().mockResolvedValue([{ deliveryType: 'ONLINE' }]),
      },
    });

    const result = await validateBookingTargetEligibility(db as never, {
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_ID,
      bookingType: 'INDIVIDUAL',
    });

    expect(result.deliveryType).toBe('ONLINE');
    expect(result.durationOption?.durationMins).toBe(45);
  });

  it('applies an active inherited employee duration override to the effective offering', async () => {
    const db = buildDb({
      employeeServiceOption: {
        findFirst: jest.fn().mockResolvedValue({ durationOverride: 50 }),
      },
    });

    const result = await validateBookingTargetEligibility(db as never, {
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_ID,
      deliveryType: 'IN_PERSON',
      bookingType: 'INDIVIDUAL',
    });

    expect(result.durationOption?.durationMins).toBe(50);
  });

  it.each([
    ['inactive duration', { isActive: false }, 'Selected duration option is not offered by this practitioner'],
    ['foreign duration', { serviceId: 'other-service' }, 'Duration option does not belong to the selected service'],
  ])('rejects a concrete target with %s before booking', async (_name, duration, message) => {
    const db = buildDb({
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue({
          id: DURATION_ID,
          serviceId: SERVICE_ID,
          employeeServiceId: null,
          deliveryType: 'IN_PERSON',
          durationMins: 60,
          isActive: true,
          ...duration,
        }),
      },
    });

    await expect(
      validateBookingTargetEligibility(db as never, {
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_ID,
        deliveryType: 'IN_PERSON',
        bookingType: 'INDIVIDUAL',
      }),
    ).rejects.toThrow(message);
  });

  it('rejects a disabled delivery even when the service supports it', async () => {
    const db = buildDb({
      employeeService: {
        findUnique: jest.fn().mockResolvedValue({
          id: LINK_ID,
          employeeId: EMPLOYEE_ID,
          serviceId: SERVICE_ID,
          isActive: true,
          disabledDeliveryTypes: ['ONLINE'],
          useCustomPricing: false,
        }),
      },
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue({
          id: DURATION_ID,
          serviceId: SERVICE_ID,
          employeeServiceId: null,
          deliveryType: 'ONLINE',
          durationMins: 60,
          isActive: true,
        }),
      },
      serviceBookingConfig: {
        findMany: jest.fn().mockResolvedValue([{ deliveryType: 'ONLINE' }]),
      },
    });

    await expect(
      validateBookingTargetEligibility(db as never, {
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_ID,
        deliveryType: 'ONLINE',
        bookingType: 'INDIVIDUAL',
      }),
    ).rejects.toThrow('Practitioner does not offer this delivery type');
  });

  it('requires custom-pricing practitioners to use their owned active duration', async () => {
    const db = buildDb({
      employeeService: {
        findUnique: jest.fn().mockResolvedValue({
          id: LINK_ID,
          employeeId: EMPLOYEE_ID,
          serviceId: SERVICE_ID,
          isActive: true,
          disabledDeliveryTypes: [],
          useCustomPricing: true,
        }),
      },
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      validateBookingTargetEligibility(db as never, {
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_ID,
        deliveryType: 'IN_PERSON',
        bookingType: 'INDIVIDUAL',
      }),
    ).rejects.toThrow('Selected duration option is not offered by this practitioner');
  });

  it('rejects delivery unsupported by the active service configs', async () => {
    const db = buildDb({
      serviceBookingConfig: {
        findMany: jest.fn().mockResolvedValue([{ deliveryType: 'IN_PERSON' }]),
      },
      serviceDurationOption: {
        findFirst: jest.fn().mockResolvedValue({
          id: DURATION_ID,
          serviceId: SERVICE_ID,
          employeeServiceId: null,
          deliveryType: 'ONLINE',
          durationMins: 60,
          isActive: true,
        }),
      },
    });

    await expect(
      validateBookingTargetEligibility(db as never, {
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_ID,
        deliveryType: 'ONLINE',
        bookingType: 'INDIVIDUAL',
      }),
    ).rejects.toThrow('Service does not support ONLINE delivery type');
  });
});
