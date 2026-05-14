import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { createHash } from 'crypto';
import { VerifyEmailHandler } from './verify-email.handler';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';

describe('VerifyEmailHandler', () => {
  let handler: VerifyEmailHandler;
  let prisma: {
    emailVerificationToken: { findFirst: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock };
    $transaction: jest.Mock;
  };
  let cls: { run: jest.Mock; set: jest.Mock };

  const rawToken = 'b'.repeat(64);
  const tokenSelector = rawToken.slice(0, 8);
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  beforeEach(async () => {
    prisma = {
      emailVerificationToken: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(prisma)),
    };
    cls = {
      run: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerifyEmailHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ClsService, useValue: cls },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
            withBypassTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
          },
        },
      ],
    }).compile();
    handler = moduleRef.get(VerifyEmailHandler);
  });

  it('rejects unknown token (BadRequestException)', async () => {
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ token: rawToken })).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects expired token', async () => {
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash,
      tokenSelector,
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    await expect(handler.execute({ token: rawToken })).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.update).not.toHaveBeenCalled();
  });

  it('rejects already-consumed token', async () => {
    // consumedAt: null filter means a consumed token is not found by findFirst.
    prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ token: rawToken })).rejects.toThrow(BadRequestException);
    expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenSelector,
          tokenHash,
          consumedAt: null,
        }),
      }),
    );
  });

  it('marks token consumed and updates user.emailVerifiedAt on success', async () => {
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash,
      tokenSelector,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });

    const result = await handler.execute({ token: rawToken });

    expect(result).toEqual({ success: true });
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { consumedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });
});
