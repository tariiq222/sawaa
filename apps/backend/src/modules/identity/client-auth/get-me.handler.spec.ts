import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetMeHandler } from './get-me.handler';

describe('GetMeHandler', () => {
  let handler: GetMeHandler;
  let prisma: { client: { findFirst: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetMeHandler,
        { provide: PrismaService, useValue: { client: { findFirst: jest.fn() } } },
      ],
    }).compile();
    handler = module.get<GetMeHandler>(GetMeHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  const row = {
    id: 'c1',
    name: 'Salem',
    firstName: 'Salem',
    lastName: null,
    email: 'salem@example.com',
    phone: '+966512345678',
    emailVerified: new Date('2026-01-01'),
    phoneVerified: new Date('2026-01-02'),
    avatarUrl: null,
    gender: 'MALE',
    dateOfBirth: null,
    preferredLocale: 'ar',
    pushEnabled: true,
    accountType: 'FULL',
    claimedAt: new Date('2026-01-03'),
    createdAt: new Date('2026-01-04'),
  };

  it('returns the unified client profile with normalized enums', async () => {
    prisma.client.findFirst.mockResolvedValue(row);

    await expect(handler.execute('c1')).resolves.toEqual({
      ...row,
      gender: 'male',
      accountType: 'full',
      unverifiedEmail: null,
    });
  });

  it('maps null gender and walk-in account type', async () => {
    prisma.client.findFirst.mockResolvedValue({ ...row, gender: null, accountType: 'WALK_IN' });
    await expect(handler.execute('c1')).resolves.toMatchObject({ gender: null, accountType: 'walk_in' });
  });

  it('never echoes an unverified stored email', async () => {
    prisma.client.findFirst.mockResolvedValue({ ...row, emailVerified: null });
    await expect(handler.execute('c1')).resolves.toMatchObject({ email: null, emailVerified: null });
  });

  it('exposes an unverified stored email only as unverifiedEmail', async () => {
    prisma.client.findFirst.mockResolvedValue({ ...row, emailVerified: null });
    await expect(handler.execute('c1')).resolves.toMatchObject({ email: null, unverifiedEmail: 'salem@example.com' });
  });

  it('returns null unverifiedEmail when the email is verified', async () => {
    prisma.client.findFirst.mockResolvedValue(row);
    await expect(handler.execute('c1')).resolves.toMatchObject({ email: 'salem@example.com', unverifiedEmail: null });
  });

  it('returns null unverifiedEmail when no email is stored', async () => {
    prisma.client.findFirst.mockResolvedValue({ ...row, email: null, emailVerified: null });
    await expect(handler.execute('c1')).resolves.toMatchObject({ email: null, unverifiedEmail: null });
  });

  it('queries with deletedAt: null so soft-deleted clients are excluded', async () => {
    prisma.client.findFirst.mockResolvedValue(row);
    await handler.execute('c1');
    expect(prisma.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'c1', deletedAt: null }) }),
    );
  });

  it('selects ONLY the profile fields (no password / staff-only / medical fields leak)', async () => {
    prisma.client.findFirst.mockResolvedValue(row);
    await handler.execute('c1');

    const call = prisma.client.findFirst.mock.calls[0][0];
    expect(Object.keys(call.select).sort()).toEqual(
      [
        'accountType', 'avatarUrl', 'claimedAt', 'createdAt', 'dateOfBirth', 'email',
        'emailVerified', 'firstName', 'gender', 'id', 'lastName', 'name', 'phone',
        'phoneVerified', 'preferredLocale', 'pushEnabled',
      ].sort(),
    );
  });

  it('throws NotFoundException when the client does not exist (or is soft-deleted)', async () => {
    prisma.client.findFirst.mockResolvedValue(null);
    await expect(handler.execute('ghost')).rejects.toThrow(NotFoundException);
  });

  it('propagates Prisma errors', async () => {
    prisma.client.findFirst.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute('c1')).rejects.toThrow('DB down');
  });
});
