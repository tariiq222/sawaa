import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeactivateUserHandler } from './deactivate-user.handler';

describe('DeactivateUserHandler', () => {
  let handler: DeactivateUserHandler;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeactivateUserHandler,
        {
          provide: PrismaService,
          useValue: { user: { findUnique: jest.fn(), update: jest.fn() } },
        },
      ],
    }).compile();

    handler = module.get<DeactivateUserHandler>(DeactivateUserHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('resolves when the user exists and is set to isActive=false', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });

    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000001' }),
    ).resolves.toBeUndefined();

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      data: { isActive: false },
    });
  });

  it('looks up the user by id BEFORE attempting the update', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });

    await handler.execute({ userId: 'u1' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException and does NOT update when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'ghost' })).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does NOT receive any other user fields (defensive: name/email/etc. are untouched)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });

    await handler.execute({ userId: 'u1' });

    const call = prisma.user.update.mock.calls[0][0];
    expect(call.data).toEqual({ isActive: false });
    expect((call.data as any).email).toBeUndefined();
    expect((call.data as any).name).toBeUndefined();
    expect((call.data as any).role).toBeUndefined();
  });

  it('propagates Prisma errors when update rejects', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockRejectedValue(new Error('DB down'));
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow('DB down');
  });
});
