import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ChatBookingQuoteService } from './chat-booking-quote.service';

const START = new Date('2026-08-15T09:00:00.000Z');

function buildHarness() {
  const db = {
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', nameAr: 'الفرع', isActive: true }) },
    client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
    employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1', name: 'سارة', isActive: true }) },
    service: { findFirst: jest.fn().mockResolvedValue({
      id: 'service-1', nameAr: 'جلسة إرشاد أسري', isActive: true,
      archivedAt: null, isHidden: false, category: { bookingMode: 'SERVICES' },
    }) },
    employeeService: { findUnique: jest.fn().mockResolvedValue({
      id: 'employee-service-1', isActive: true, useCustomPricing: false,
      disabledDeliveryTypes: [],
    }) },
    serviceBookingConfig: { findUnique: jest.fn().mockResolvedValue({ id: 'config-1', isActive: true }) },
    booking: { findUnique: jest.fn() },
  };
  const price = {
    resolve: jest.fn().mockResolvedValue({
      price: 20_000,
      durationMins: 60,
      durationOptionId: 'duration-1',
      currency: 'SAR',
      isEmployeeOverride: false,
    }),
  };
  const availability = {
    execute: jest.fn().mockResolvedValue([{
      startTime: START,
      endTime: new Date(START.getTime() + 60 * 60_000),
    }]),
  };
  const service = new ChatBookingQuoteService(db as never, price as never, availability as never);
  return { service, db, price, availability };
}

describe('ChatBookingQuoteService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-13T09:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('validates IDs and returns a server-priced immutable individual quote', async () => {
    const { service, price, availability } = buildHarness();

    const quote = await service.quoteBooking({
      clientId: 'client-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      durationOptionId: 'duration-1',
      deliveryType: DeliveryType.IN_PERSON,
    });

    expect(quote.payload).toEqual({
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      endsAt: '2026-08-15T10:00:00.000Z',
      durationMins: 60,
      durationOptionId: 'duration-1',
      bookingType: 'INDIVIDUAL',
      deliveryType: DeliveryType.IN_PERSON,
      price: 20_000,
      currency: 'SAR',
    });
    expect(quote.summary).toEqual(expect.objectContaining({
      action: 'CREATE_BOOKING',
      serviceName: 'جلسة إرشاد أسري',
      employeeName: 'سارة',
      branchName: 'الفرع',
      price: 20_000,
      durationMins: 60,
    }));
    expect(price.resolve).toHaveBeenCalledWith(expect.objectContaining({
      serviceId: 'service-1',
      employeeServiceId: 'employee-service-1',
      durationOptionId: 'duration-1',
      bookingType: 'INDIVIDUAL',
      deliveryType: DeliveryType.IN_PERSON,
    }), undefined);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({
      employeeId: 'employee-1',
      durationMins: 60,
      transaction: undefined,
    }));
  });

  it('uses the supplied transaction for every execution-time read', async () => {
    const { service, db, price, availability } = buildHarness();
    const outside = db.branch.findFirst;
    const tx = {
      ...db,
      branch: { findFirst: jest.fn().mockResolvedValue({ id: 'branch-1', nameAr: 'الفرع', isActive: true }) },
    };

    await service.quoteBooking({
      clientId: 'client-1', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      scheduledAt: START.toISOString(), deliveryType: DeliveryType.IN_PERSON, transaction: tx as never,
    });

    expect(outside).not.toHaveBeenCalled();
    expect(tx.branch.findFirst).toHaveBeenCalled();
    expect(price.resolve).toHaveBeenCalledWith(expect.any(Object), tx);
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ transaction: tx }));
  });

  it('rejects an unavailable slot and inactive or mismatched booking resources', async () => {
    const unavailable = buildHarness();
    unavailable.availability.execute.mockResolvedValue([]);
    await expect(unavailable.service.quoteBooking({
      clientId: 'client-1', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      scheduledAt: START.toISOString(), deliveryType: DeliveryType.IN_PERSON,
    })).rejects.toThrow('Selected booking time is not available');

    const wrongClient = buildHarness();
    wrongClient.db.client.findFirst.mockResolvedValue(null);
    await expect(wrongClient.service.quoteBooking({
      clientId: 'missing', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      scheduledAt: START.toISOString(), deliveryType: DeliveryType.IN_PERSON,
    })).rejects.toThrow(NotFoundException);

    const disabledDelivery = buildHarness();
    disabledDelivery.db.employeeService.findUnique.mockResolvedValue({
      id: 'employee-service-1', isActive: true, useCustomPricing: false,
      disabledDeliveryTypes: [DeliveryType.IN_PERSON],
    });
    await expect(disabledDelivery.service.quoteBooking({
      clientId: 'client-1', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      scheduledAt: START.toISOString(), deliveryType: DeliveryType.IN_PERSON,
    })).rejects.toThrow(BadRequestException);
  });

  it('quotes an owned reschedule with the existing duration and no model-supplied duration', async () => {
    const { service, db, availability } = buildHarness();
    db.booking.findUnique.mockResolvedValue({
      id: 'booking-1', clientId: 'client-1', status: BookingStatus.CONFIRMED,
      isHistoricalImport: false, scheduledAt: new Date('2026-08-14T09:00:00.000Z'),
      endsAt: new Date('2026-08-14T10:30:00.000Z'), durationMins: 90,
      branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      durationOptionId: 'duration-1', bookingType: 'INDIVIDUAL',
      deliveryType: DeliveryType.IN_PERSON, price: 20_000, currency: 'SAR',
      serviceNameSnapshot: 'جلسة متابعة', employeeNameSnapshot: 'سارة', branchNameSnapshot: 'الفرع',
    });
    availability.execute.mockResolvedValue([{
      startTime: START,
      endTime: new Date(START.getTime() + 90 * 60_000),
    }]);

    const quote = await service.quoteReschedule({
      clientId: 'client-1', bookingId: 'booking-1', newScheduledAt: START.toISOString(),
    });

    expect(quote.payload).toEqual(expect.objectContaining({
      bookingId: 'booking-1',
      newScheduledAt: START.toISOString(),
      newEndsAt: '2026-08-15T10:30:00.000Z',
      durationMins: 90,
    }));
    expect(availability.execute).toHaveBeenCalledWith(expect.objectContaining({ durationMins: 90 }));
    expect(quote.payload).not.toHaveProperty('newDurationMins');
  });

  it('rejects non-owned or historical reschedule and cancellation prepares', async () => {
    const nonOwned = buildHarness();
    nonOwned.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', clientId: 'other-client' });
    await expect(nonOwned.service.quoteCancellation({ clientId: 'client-1', bookingId: 'booking-1' }))
      .rejects.toThrow(ForbiddenException);

    const historical = buildHarness();
    historical.db.booking.findUnique.mockResolvedValue({
      id: 'booking-1', clientId: 'client-1', isHistoricalImport: true,
    });
    await expect(historical.service.quoteReschedule({
      clientId: 'client-1', bookingId: 'booking-1', newScheduledAt: START.toISOString(),
    })).rejects.toThrow(BadRequestException);
  });

  it('rejects cancellation preparation for an elapsed appointment', async () => {
    const { service, db } = buildHarness();
    db.booking.findUnique.mockResolvedValue({
      id: 'booking-1', clientId: 'client-1', status: BookingStatus.CONFIRMED,
      isHistoricalImport: false, scheduledAt: new Date('2026-08-13T08:59:59.999Z'),
      bookingType: 'INDIVIDUAL', durationMins: 60, deliveryType: DeliveryType.IN_PERSON,
    });

    await expect(service.quoteCancellation({ clientId: 'client-1', bookingId: 'booking-1' }))
      .rejects.toThrow('Only future appointments');
  });
});
