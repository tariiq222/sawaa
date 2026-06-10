import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateClientProfileHandler } from './update-client-profile.handler';

describe('UpdateClientProfileHandler', () => {
  let handler: UpdateClientProfileHandler;

  const existingClient = {
    id: 'cl-1',
    name: 'Ahmed Ali',
    firstName: 'Ahmed',
    middleName: null,
    lastName: 'Ali',
    email: 'ahmed@example.com',
    phone: '+966500000001',
    emailVerified: null,
    phoneVerified: new Date('2026-01-01T00:00:00Z'),
    accountType: 'FULL',
    claimedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  };

  const updatedProfile = {
    id: 'cl-1',
    name: 'Ahmed Ali',
    email: 'ahmed@example.com',
    phone: '+966500000001',
    emailVerified: null,
    phoneVerified: new Date('2026-01-01T00:00:00Z'),
    accountType: 'FULL',
    claimedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateClientProfileHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<UpdateClientProfileHandler>(UpdateClientProfileHandler);
  });

  it('rejects an empty body', async () => {
    await expect(handler.execute('cl-1', {})).rejects.toThrow(BadRequestException);
    expect(mockPrisma.client.findFirst).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when client is missing or deleted', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(null);

    await expect(handler.execute('cl-1', { name: 'New Name' })).rejects.toThrow(NotFoundException);
    expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'cl-1', deletedAt: null },
    });
  });

  it('updates name and keeps firstName/middleName/lastName in sync', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue({ ...updatedProfile, name: 'Sara Mohammed Otaibi' });

    const result = await handler.execute('cl-1', { name: 'Sara Mohammed Otaibi' });

    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cl-1' },
        data: {
          name: 'Sara Mohammed Otaibi',
          firstName: 'Sara',
          middleName: null,
          lastName: 'Mohammed Otaibi',
        },
      }),
    );
    expect(result.name).toBe('Sara Mohammed Otaibi');
  });

  it('updates a single-token name with null lastName', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue({ ...updatedProfile, name: 'Sara' });

    await handler.execute('cl-1', { name: 'Sara' });

    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: 'Sara', firstName: 'Sara', middleName: null, lastName: null },
      }),
    );
  });

  it('updates phone and resets phoneVerified when phone changes', async () => {
    mockPrisma.client.findFirst
      .mockResolvedValueOnce(existingClient) // load client
      .mockResolvedValueOnce(null); // duplicate check
    mockPrisma.client.update.mockResolvedValue({ ...updatedProfile, phone: '+966500000002', phoneVerified: null });

    const result = await handler.execute('cl-1', { phone: '+966500000002' });

    expect(mockPrisma.client.findFirst).toHaveBeenNthCalledWith(2, {
      where: { phone: '+966500000002', deletedAt: null, NOT: { id: 'cl-1' } },
    });
    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { phone: '+966500000002', phoneVerified: null },
      }),
    );
    expect(result.phoneVerified).toBeNull();
  });

  it('throws ConflictException when phone belongs to another client', async () => {
    mockPrisma.client.findFirst
      .mockResolvedValueOnce(existingClient)
      .mockResolvedValueOnce({ id: 'cl-2' });

    await expect(handler.execute('cl-1', { phone: '+966500000002' })).rejects.toThrow(
      new ConflictException('رقم الجوال مستخدم في حساب آخر'),
    );
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('maps a P2002 unique-constraint violation on update to ConflictException (TOCTOU race)', async () => {
    mockPrisma.client.findFirst
      .mockResolvedValueOnce(existingClient) // load client
      .mockResolvedValueOnce(null); // duplicate pre-check passes
    const p2002 = Object.assign(
      Object.create(Prisma.PrismaClientKnownRequestError.prototype),
      { code: 'P2002', message: 'Unique constraint failed on the fields: (`phone`)' },
    );
    mockPrisma.client.update.mockRejectedValue(p2002);

    await expect(handler.execute('cl-1', { phone: '+966500000002' })).rejects.toThrow(
      new ConflictException('رقم الجوال مستخدم في حساب آخر'),
    );
    expect(mockPrisma.client.update).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-P2002 update errors untouched', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    const dbError = new Error('connection lost');
    mockPrisma.client.update.mockRejectedValue(dbError);

    await expect(handler.execute('cl-1', { name: 'Sara' })).rejects.toBe(dbError);
  });

  it('skips duplicate check and phoneVerified reset when phone is unchanged', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue(updatedProfile);

    await handler.execute('cl-1', { phone: '+966500000001' });

    // only the initial client load — no duplicate lookup
    expect(mockPrisma.client.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} }),
    );
  });
});
