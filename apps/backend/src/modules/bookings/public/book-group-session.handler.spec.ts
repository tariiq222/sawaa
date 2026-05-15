import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { GroupSessionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { BookGroupSessionHandler } from './book-group-session.handler';

function createSession(overrides?: Partial<any>) {
  return {
    id: 'gs1',
    isPublic: true,
    status: GroupSessionStatus.OPEN,
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxCapacity: 10,
    enrolledCount: 5,
    waitlistEnabled: true,
    price: 100,
    currency: 'SAR',
    ...overrides,
  };
}

describe('BookGroupSessionHandler', () => {
  let handler: BookGroupSessionHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      groupSession: { findFirst: jest.fn(), update: jest.fn() },
      groupEnrollment: { findUnique: jest.fn(), create: jest.fn() },
      groupSessionWaitlist: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      booking: { findFirst: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookGroupSessionHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<BookGroupSessionHandler>(BookGroupSessionHandler);
  });

  it('should be defined', () => expect(handler).toBeDefined());

  it('should throw when session not found', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(NotFoundException);
  });

  it('should throw when session already started', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ scheduledAt: new Date(Date.now() - 1000) }));
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(BadRequestException);
  });

  it('should throw when already enrolled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession());
    prisma.groupEnrollment.findUnique.mockResolvedValue({ id: 'e1' });
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
  });

  it('should throw when already on waitlist', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession());
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue({ id: 'w1' });
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(ConflictException);
  });

  it('should create booking when spots available', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 5, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue({ bookingNumber: 'BK-099' });
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 'BK-001' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.type).toBe('BOOKED');
    expect(result.bookingId).toBe('b1');
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: expect.any(Date) }),
    }));
  });

  it('should create free booking without expiry', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ price: 0, enrolledCount: 5, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue({ id: 'b1', bookingNumber: 'BK-002' });
    prisma.groupEnrollment.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(prisma.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ expiresAt: null }),
    }));
  });

  it('should add to waitlist when full and waitlist enabled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findFirst.mockResolvedValue({ position: 3 });
    prisma.groupSessionWaitlist.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.type).toBe('WAITLISTED');
    expect(result.waitlistPosition).toBe(4);
  });

  it('should add to waitlist at position 1 when no existing entries', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10 }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findFirst.mockResolvedValue(null);
    prisma.groupSessionWaitlist.create.mockResolvedValue({});
    prisma.groupSession.update.mockResolvedValue({});

    const result = await handler.execute({ groupSessionId: 'gs1', clientId: 'c1' });
    expect(result.waitlistPosition).toBe(1);
  });

  it('should throw when full and waitlist disabled', async () => {
    prisma.groupSession.findFirst.mockResolvedValue(createSession({ enrolledCount: 10, maxCapacity: 10, waitlistEnabled: false }));
    prisma.groupEnrollment.findUnique.mockResolvedValue(null);
    prisma.groupSessionWaitlist.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: 'gs1', clientId: 'c1' })).rejects.toThrow(BadRequestException);
  });
});
