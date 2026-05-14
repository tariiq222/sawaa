import { Test } from '@nestjs/testing';
import { ChangePasswordHandler } from './change-password.handler';
import { PrismaService } from '../../../infrastructure/database';
import { PasswordService } from '../shared/password.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };
  let passwordService: { verify: jest.Mock; hash: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    passwordService = { verify: jest.fn(), hash: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChangePasswordHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    handler = module.get(ChangePasswordHandler);
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ userId: 'u1', currentPassword: 'old', newPassword: 'new123' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when current password is wrong', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    passwordService.verify.mockResolvedValue(false);
    await expect(
      handler.execute({ userId: 'u1', currentPassword: 'wrong', newPassword: 'new123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates password when current password is correct', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    passwordService.verify.mockResolvedValue(true);
    passwordService.hash.mockResolvedValue('newHash');
    prisma.user.update.mockResolvedValue({});

    await handler.execute({ userId: 'u1', currentPassword: 'old', newPassword: 'new123' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'newHash' },
    });
  });
});