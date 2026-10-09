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
    preferredLocale: 'en',
    pushEnabled: true,
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
    preferredLocale: 'ar',
    pushEnabled: false,
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

  it('updates the client-owned avatar URL without using the administrative client updater', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue({
      ...updatedProfile,
      avatarUrl: 'https://cdn.example.com/avatars/sara.jpg',
    });

    await handler.execute('cl-1', {
      avatarUrl: 'https://cdn.example.com/avatars/sara.jpg',
    });

    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { avatarUrl: 'https://cdn.example.com/avatars/sara.jpg' },
      }),
    );
  });

  it.each(['+966500000002', 'invalid-phone'])('requires verification for a different phone %s without an ownership lookup', async phone => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    await expect(handler.execute('cl-1', { phone })).rejects.toThrow(
      new BadRequestException({ code: 'phone_change_requires_verification', message: 'phone_change_requires_verification' }),
    );
    expect(mockPrisma.client.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it.each(['0500000001', '00966500000001', '+966 50 000 0001'])('ignores normalized copies of the current phone %s', async phone => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue(updatedProfile);
    await handler.execute('cl-1', { phone });
    expect(mockPrisma.client.findFirst).toHaveBeenCalledTimes(1);
    expect(mockPrisma.client.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
  });

  it.each([null, ''])('lets a client without a phone save other fields when older builds send %p', async phone => {
    mockPrisma.client.findFirst.mockResolvedValue({ ...existingClient, phone: null });
    mockPrisma.client.update.mockResolvedValue(updatedProfile);
    await handler.execute('cl-1', { name: 'Sara', phone } as never);
    expect(mockPrisma.client.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ phone: expect.anything() }) }));
  });

  it('rejects clearing an existing phone through the profile form', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    await expect(handler.execute('cl-1', { phone: null } as never)).rejects.toMatchObject({ response: { code: 'phone_change_requires_verification' } });
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it('does not enumerate a phone in a unique-constraint fallback', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    const p2002 = Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), { code: 'P2002', meta: { target: ['phone'] } });
    mockPrisma.client.update.mockRejectedValue(p2002);
    await expect(handler.execute('cl-1', { name: 'Sara' })).rejects.toThrow(new ConflictException({ code: 'details_unavailable' }));
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

  it('updates preferences without changing unrelated profile fields and returns the saved values', async () => {
    mockPrisma.client.findFirst.mockResolvedValue(existingClient);
    mockPrisma.client.update.mockResolvedValue({
      ...updatedProfile,
      preferredLocale: 'ar',
      pushEnabled: false,
    });

    const result = await handler.execute('cl-1', {
      preferredLocale: 'ar',
      pushEnabled: false,
    });

    expect(mockPrisma.client.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cl-1' },
        data: { preferredLocale: 'ar', pushEnabled: false },
        select: expect.objectContaining({ preferredLocale: true, pushEnabled: true }),
      }),
    );
    expect(result).toMatchObject({ preferredLocale: 'ar', pushEnabled: false });
  });

  describe('email', () => {
    const phoneOnlyClient = { ...existingClient, email: null, emailVerified: null };

    it('adds an email when the account has none, leaving emailVerified null', async () => {
      mockPrisma.client.findFirst
        .mockResolvedValueOnce(phoneOnlyClient) // load client
        .mockResolvedValueOnce(null); // email duplicate check
      mockPrisma.client.update.mockResolvedValue({
        ...updatedProfile,
        email: 'new@example.com',
        emailVerified: null,
      });

      const result = await handler.execute('cl-1', { email: 'new@example.com' });

      expect(mockPrisma.client.findFirst).toHaveBeenNthCalledWith(2, {
        where: { email: 'new@example.com', deletedAt: null, NOT: { id: 'cl-1' } },
      });
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: 'new@example.com', emailVerified: null },
        }),
      );
      expect(result.email).toBe('new@example.com');
      expect(result.emailVerified).toBeNull();
    });

    it('rejects changing an email that is already set', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(existingClient); // email: ahmed@example.com

      await expect(handler.execute('cl-1', { email: 'other@example.com' })).rejects.toThrow(
        new BadRequestException('لا يمكن تغيير البريد الإلكتروني بعد تعيينه'),
      );
      expect(mockPrisma.client.update).not.toHaveBeenCalled();
    });

    it('treats resubmitting the same email as a no-op', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(existingClient);
      mockPrisma.client.update.mockResolvedValue(updatedProfile);

      await handler.execute('cl-1', { email: 'ahmed@example.com' });

      // only the initial client load — no duplicate lookup, no rejection
      expect(mockPrisma.client.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: {} }),
      );
    });

    it('throws ConflictException when the email belongs to another client', async () => {
      mockPrisma.client.findFirst
        .mockResolvedValueOnce(phoneOnlyClient)
        .mockResolvedValueOnce({ id: 'cl-2' }); // duplicate

      await expect(handler.execute('cl-1', { email: 'taken@example.com' })).rejects.toThrow(
        new ConflictException('البريد الإلكتروني مستخدم في حساب آخر'),
      );
      expect(mockPrisma.client.update).not.toHaveBeenCalled();
    });

    it('maps a P2002 on the email column to the email ConflictException (TOCTOU race)', async () => {
      mockPrisma.client.findFirst
        .mockResolvedValueOnce(phoneOnlyClient)
        .mockResolvedValueOnce(null); // duplicate pre-check passes
      const p2002 = Object.assign(
        Object.create(Prisma.PrismaClientKnownRequestError.prototype),
        { code: 'P2002', meta: { target: ['email'] }, message: 'Unique constraint failed' },
      );
      mockPrisma.client.update.mockRejectedValue(p2002);

      await expect(handler.execute('cl-1', { email: 'taken@example.com' })).rejects.toThrow(
        new ConflictException('البريد الإلكتروني مستخدم في حساب آخر'),
      );
    });
  });
});
