import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetBookingHandler } from './get-booking.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('../booking-row.mapper', () => ({
  mapBookingRow: jest.fn().mockReturnValue({ id: 'mapped-booking' }),
}));

describe('GetBookingHandler', () => {
  let handler: GetBookingHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      booking: { findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [GetBookingHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<GetBookingHandler>(GetBookingHandler);
  });

  it('should throw NotFoundException when booking not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ bookingId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when clientId does not match', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    await expect(handler.execute({ bookingId: 'b1', clientId: 'c2' })).rejects.toThrow(ForbiddenException);
  });

  it('should return mapped booking without clientId check', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue({ id: 'c1', name: 'Client' });
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', name: 'Employee' });
    prisma.service.findFirst.mockResolvedValue({ id: 's1', name: 'Service' });

    const result = await handler.execute({ bookingId: 'b1' });
    expect(result.id).toBe('mapped-booking');
  });

  it('should return mapped booking when clientId matches', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'b1', clientId: 'c1', employeeId: 'e1', serviceId: 's1' });
    prisma.client.findFirst.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue(null);
    prisma.service.findFirst.mockResolvedValue(null);

    const result = await handler.execute({ bookingId: 'b1', clientId: 'c1' });
    expect(result.id).toBe('mapped-booking');
  });
});
