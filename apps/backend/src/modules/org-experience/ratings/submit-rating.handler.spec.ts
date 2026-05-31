import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SubmitRatingHandler } from './submit-rating.handler';

const completedBooking = {
  id: 'b',
  clientId: 'booking-client',
  employeeId: 'booking-employee',
  status: 'COMPLETED',
};

describe('SubmitRatingHandler', () => {
  let handler: SubmitRatingHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitRatingHandler,
        { provide: PrismaService, useValue: {
          booking: { findUnique: jest.fn() },
          rating: { findUnique: jest.fn(), create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<SubmitRatingHandler>(SubmitRatingHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should submit rating', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(completedBooking);
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.rating.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 4, comment: 'Good', isPublic: true,
    });
    expect(prisma.rating.create).toHaveBeenCalled();
  });

  it('should force isPublic=false even when client requests true', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(completedBooking);
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.rating.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 5, comment: 'Great', isPublic: true,
    });
    expect(prisma.rating.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isPublic: false }),
    }));
  });

  it('should derive clientId/employeeId from the booking, not the body', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(completedBooking);
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.rating.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({
      bookingId: 'b', clientId: 'spoofed-client', employeeId: 'spoofed-employee', score: 5, isPublic: false,
    });
    expect(prisma.rating.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientId: 'booking-client', employeeId: 'booking-employee' }),
    }));
  });

  it('should throw when score out of range', async () => {
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 6, comment: '', isPublic: false,
    })).rejects.toThrow();
  });

  it('should throw when booking does not exist', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 4, comment: '', isPublic: false,
    })).rejects.toThrow('Booking not found');
  });

  it('should throw when booking is not completed', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue({ ...completedBooking, status: 'CONFIRMED' });
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 4, comment: '', isPublic: false,
    })).rejects.toThrow('Booking must be completed');
  });

  it('should throw when rating already exists', async () => {
    (prisma.booking.findUnique as jest.Mock).mockResolvedValue(completedBooking);
    (prisma.rating.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });
    await expect(handler.execute({
      bookingId: 'b', clientId: 'c', employeeId: 'e', score: 3, comment: '', isPublic: false,
    })).rejects.toThrow();
  });
});
