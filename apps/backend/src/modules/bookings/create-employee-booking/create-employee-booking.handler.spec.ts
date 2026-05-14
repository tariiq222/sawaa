import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateBookingHandler } from '../create-booking/create-booking.handler';
import { CreateEmployeeBookingHandler } from './create-employee-booking.handler';

describe('CreateEmployeeBookingHandler', () => {
  let handler: CreateEmployeeBookingHandler;
  let createBookingHandler: CreateBookingHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateEmployeeBookingHandler,
        {
          provide: CreateBookingHandler,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: 'booking-id' }),
          },
        },
      ],
    }).compile();

    handler = module.get<CreateEmployeeBookingHandler>(CreateEmployeeBookingHandler);
    createBookingHandler = module.get<CreateBookingHandler>(CreateBookingHandler);
  });

  it('should delegate to CreateBookingHandler with mapped scheduledAt and default bookingType', async () => {
    const result = await handler.execute({
      branchId: 'branch-1',
      clientId: 'client-1',
      serviceId: 'service-1',
      scheduledAt: '2026-05-01T09:00:00.000Z',
      employeeId: 'employee-1',
    });

    expect(result).toEqual({ id: 'booking-id' });
    expect(createBookingHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch-1',
        clientId: 'client-1',
        employeeId: 'employee-1',
        serviceId: 'service-1',
        scheduledAt: new Date('2026-05-01T09:00:00.000Z'),
        bookingType: 'INDIVIDUAL',
      }),
    );
  });

  it('should passthrough bookingType if provided', async () => {
    await handler.execute({
      branchId: 'branch-1',
      clientId: 'client-1',
      serviceId: 'service-1',
      scheduledAt: '2026-05-01T09:00:00.000Z',
      bookingType: 'ONLINE' as never,
      employeeId: 'employee-1',
    });

    expect(createBookingHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingType: 'ONLINE' }),
    );
  });

  it('rejects when employeeId is missing (no JWT subject)', async () => {
    await expect(
      handler.execute({
        branchId: 'branch-1',
        clientId: 'client-1',
        serviceId: 'service-1',
        scheduledAt: '2026-05-01T09:00:00.000Z',
        employeeId: '',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(createBookingHandler.execute).not.toHaveBeenCalled();
  });
});
