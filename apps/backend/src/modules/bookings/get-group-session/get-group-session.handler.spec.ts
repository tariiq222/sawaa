import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GetGroupSessionHandler } from './get-group-session.handler';
import { PrismaService } from '../../../infrastructure/database';
import { GroupSessionStatus, DeliveryType, BookingStatus, BookingType } from '@prisma/client';

const enrolledAt = new Date('2026-07-01T09:00:00Z');
const checkedInAt = new Date('2026-07-01T10:05:00Z');

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const mockSession = {
  id: VALID_UUID,
  ref: 12,
  branchId: 'branch-1',
  employeeId: 'emp-1',
  programId: 'prog-1',
  title: 'Test Session',
  scheduledAt: new Date('2026-07-01T10:00:00Z'),
  durationMins: 60,
  maxCapacity: 10,
  enrolledCount: 2,
  price: 10000,
  currency: 'SAR',
  status: GroupSessionStatus.OPEN,
  deliveryType: DeliveryType.IN_PERSON,
  isPublic: false,
  descriptionAr: null,
  descriptionEn: null,
  publicDescriptionAr: null,
  publicDescriptionEn: null,
  cancelReason: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  enrollments: [
    {
      clientId: 'client-1',
      bookingId: 'booking-1',
      enrolledAt,
      booking: {
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        bookingType: BookingType.GROUP,
        deliveryType: DeliveryType.IN_PERSON,
        checkedInAt,
        completedAt: null,
        cancelledAt: null,
        confirmedAt: new Date('2026-06-30T12:00:00Z'),
      },
    },
  ],
};

const mockClient = {
  id: 'client-1',
  name: 'أحمد محمد',
  firstName: 'أحمد',
  lastName: 'محمد',
  phone: '+966501234567',
};

const mockProgram = {
  id: 'prog-1',
  nameAr: 'جلسة جماعية',
  nameEn: 'Group Session',
  departmentId: 'dept-1',
  minParticipants: 3,
};
const mockEmployee = { name: 'Dr. Ahmed', nameAr: 'د. أحمد', nameEn: 'Dr. Ahmed' };

const mockPrisma = {
  groupSession: {
    findUnique: jest.fn(),
  },
  client: {
    findMany: jest.fn(),
  },
  groupProgram: {
    findUnique: jest.fn(),
  },
  employee: {
    findUnique: jest.fn(),
  },
};

describe('GetGroupSessionHandler', () => {
  let handler: GetGroupSessionHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GetGroupSessionHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(GetGroupSessionHandler);
    jest.clearAllMocks();
    mockPrisma.groupProgram.findUnique.mockResolvedValue(mockProgram);
    mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
  });

  it('returns session with enriched enrollments (client + booking details)', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(mockSession);
    mockPrisma.client.findMany.mockResolvedValue([mockClient]);

    const result = await handler.execute({ groupSessionId: VALID_UUID });

    expect(result.id).toBe(VALID_UUID);
    expect(result.enrollments).toHaveLength(1);

    const enrollment = result.enrollments[0];
    expect(enrollment.clientId).toBe('client-1');
    expect(enrollment.bookingId).toBe('booking-1');
    expect(enrollment.enrolledAt).toBe(enrolledAt);

    // Client data
    expect(enrollment.client).not.toBeNull();
    expect(enrollment.client?.id).toBe('client-1');
    expect(enrollment.client?.name).toBe('أحمد محمد');
    expect(enrollment.client?.phone).toBe('+966501234567');

    // Booking data
    expect(enrollment.booking).not.toBeNull();
    expect(enrollment.booking?.status).toBe(BookingStatus.CONFIRMED);
    expect(enrollment.booking?.bookingType).toBe(BookingType.GROUP);
    expect(enrollment.booking?.checkedInAt).toBe(checkedInAt);
    expect(enrollment.booking?.completedAt).toBeNull();

    // Program and employee
    expect(result.program).toEqual(mockProgram);
    expect(result.employee).toEqual(mockEmployee);

    // spotsLeft = maxCapacity(10) - enrolledCount(2)
    expect(result.spotsLeft).toBe(8);
  });

  it('returns null client when client is not found', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(mockSession);
    mockPrisma.client.findMany.mockResolvedValue([]);

    const result = await handler.execute({ groupSessionId: VALID_UUID });
    expect(result.enrollments[0].client).toBeNull();
  });

  it('skips client query when there are no enrollments', async () => {
    const emptySession = { ...mockSession, enrollments: [] };
    mockPrisma.groupSession.findUnique.mockResolvedValue(emptySession);

    const result = await handler.execute({ groupSessionId: VALID_UUID });
    expect(result.enrollments).toHaveLength(0);
    expect(mockPrisma.client.findMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    mockPrisma.groupSession.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ groupSessionId: VALID_UUID })).rejects.toThrow(NotFoundException);
  });

  describe('ref-based lookup', () => {
    it('resolves by UUID — calls findUnique with { id }', async () => {
      mockPrisma.groupSession.findUnique.mockResolvedValue({ ...mockSession, enrollments: [] });

      await handler.execute({ groupSessionId: VALID_UUID });

      expect(mockPrisma.groupSession.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: VALID_UUID } }),
      );
    });

    it('resolves by GS-<n> ref — calls findUnique with { ref: n }', async () => {
      mockPrisma.groupSession.findUnique.mockResolvedValue({ ...mockSession, enrollments: [] });

      await handler.execute({ groupSessionId: 'GS-12' });

      expect(mockPrisma.groupSession.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ref: 12 } }),
      );
    });

    it('is case-insensitive for the prefix (gs-5 is valid)', async () => {
      mockPrisma.groupSession.findUnique.mockResolvedValue({ ...mockSession, enrollments: [] });

      await handler.execute({ groupSessionId: 'gs-5' });

      expect(mockPrisma.groupSession.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ref: 5 } }),
      );
    });

    it('throws BadRequestException for an unrecognised identifier', async () => {
      await expect(handler.execute({ groupSessionId: 'not-valid' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when GS-ref lookup returns null', async () => {
      mockPrisma.groupSession.findUnique.mockResolvedValue(null);
      await expect(handler.execute({ groupSessionId: 'GS-9999' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
