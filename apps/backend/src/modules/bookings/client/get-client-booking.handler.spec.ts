import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetClientBookingHandler } from './get-client-booking.handler';
import { ClientCancellationOutcomeHandler } from './client-cancellation-outcome.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('GetClientBookingHandler', () => {
  let handler: GetClientBookingHandler;

  const booking = {
    id: 'bk-1',
    clientId: 'cl-1',
    employeeId: 'emp-1',
    serviceId: 'svc-1',
    branchId: 'br-1',
    status: 'CONFIRMED',
    bookingType: 'INDIVIDUAL',
    deliveryType: 'ONLINE',
    bookingNumber: 3,
    scheduledAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-01T11:00:00Z'),
    durationMins: 60,
    price: 150,
    currency: 'SAR',
    zoomJoinUrl: 'https://zoom.us/j/123',
    zoomHostUrl: 'https://zoom.us/s/host-secret',
    zoomStartUrl: 'https://zoom.us/s/start-secret',
    notes: 'internal staff note',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockPrisma = {
    booking: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    service: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    rating: { findUnique: jest.fn() },
  };
  const mockOutcome = { execute: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', name: 'John', nameAr: 'جون', avatarUrl: null });
    mockPrisma.service.findFirst.mockResolvedValue({ id: 'svc-1', nameEn: 'Therapy', nameAr: 'علاج', price: 150, durationMins: 60 });
    mockPrisma.branch.findFirst.mockResolvedValue({ id: 'br-1', nameEn: 'Main', nameAr: 'الرئيسي' });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.rating.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetClientBookingHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ClientCancellationOutcomeHandler, useValue: mockOutcome },
      ],
    }).compile();
    handler = module.get(GetClientBookingHandler);
  });

  it('scopes the lookup to the caller and 404s for a foreign or missing id', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(null);

    await expect(handler.execute('bk-other', 'cl-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith({ where: { id: 'bk-other', clientId: 'cl-1' } });
    expect(mockPrisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('returns the unified shape with names, invoice, rating state and no host URLs', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(booking);
    mockPrisma.invoice.findFirst.mockResolvedValue({
      id: 'inv-1', status: 'PAID', subtotal: 15000, vatRate: 0, total: 15000,
      payments: [{ id: 'pay-1', status: 'COMPLETED', amount: 15000, refundedAmount: 0, method: 'ONLINE_CARD' }],
    });
    mockPrisma.rating.findUnique.mockResolvedValue({ id: 'r-1' });

    const dto = await handler.execute('bk-1', 'cl-1');

    expect(dto).toMatchObject({
      id: 'bk-1', status: 'CONFIRMED', deliveryType: 'ONLINE', price: '150',
      serviceName: 'Therapy', serviceNameAr: 'علاج', employeeName: 'John', employeeNameAr: 'جون',
      branchName: 'Main', branchNameAr: 'الرئيسي',
      invoiceId: 'inv-1', invoiceStatus: 'PAID', paymentStatus: 'COMPLETED', hasRated: true,
      zoomJoinUrl: 'https://zoom.us/j/123', zoomHostUrl: null, zoomStartUrl: null,
    });
    expect(dto).not.toHaveProperty('notes');
    expect(dto.cancellationRefund).toBeUndefined();
    expect(mockOutcome.execute).not.toHaveBeenCalled();
  });

  it('attaches the persisted refund outcome for cancelled bookings', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue({ ...booking, status: 'CANCELLED' });
    mockOutcome.execute.mockResolvedValue({ status: 'COMPLETED', completedAmount: 5000 });

    const dto = await handler.execute('bk-1', 'cl-1');

    expect(dto.cancellationRefund).toEqual({ status: 'COMPLETED', completedAmount: 5000 });
    expect(mockOutcome.execute).toHaveBeenCalledWith('bk-1', 'cl-1');
  });

  it('keeps legacy lower-case enums when asked (mobile route)', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue(booking);
    const dto = await handler.execute('bk-1', 'cl-1', { enumCase: 'lower' });
    expect(dto.status).toBe('confirmed');
    expect(dto.deliveryType).toBe('online');
  });

  it('falls back to booking-time snapshots when the related rows are gone', async () => {
    mockPrisma.booking.findFirst.mockResolvedValue({
      ...booking, serviceNameSnapshot: 'Old service', employeeNameSnapshot: 'Old employee', branchNameSnapshot: 'Old branch',
    });
    mockPrisma.employee.findFirst.mockResolvedValue(null);
    mockPrisma.service.findFirst.mockResolvedValue(null);
    mockPrisma.branch.findFirst.mockResolvedValue(null);

    const dto = await handler.execute('bk-1', 'cl-1');
    expect(dto).toMatchObject({
      serviceName: 'Old service', employeeName: 'Old employee', branchName: 'Old branch',
      employee: null, service: null, branch: null, paymentStatus: null, invoiceId: null,
    });
  });
});
