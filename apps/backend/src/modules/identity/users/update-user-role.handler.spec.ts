import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateUserRoleHandler } from './update-user-role.handler';

describe('UpdateUserRoleHandler', () => {
  let handler: UpdateUserRoleHandler;
  let prisma: any;
  let rlsTransaction: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      customRole: { findUnique: jest.fn() },
    };
    rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    handler = new UpdateUserRoleHandler(prisma, rlsTransaction);
  });

  it('rejects self role-change', async () => {
    await expect(
      handler.execute({ actorUserId: 'u1', targetUserId: 'u1', role: 'ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires role or customRoleId', async () => {
    await expect(
      handler.execute({ actorUserId: 'a', targetUserId: 'b' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects ADMIN granting SUPER_ADMIN', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'a', role: 'ADMIN', isSuperAdmin: false })
      .mockResolvedValueOnce({ id: 'b', role: 'RECEPTIONIST' });
    await expect(
      handler.execute({ actorUserId: 'a', targetUserId: 'b', role: 'SUPER_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects modifying user at equal rank', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'a', role: 'ADMIN', isSuperAdmin: false })
      .mockResolvedValueOnce({ id: 'b', role: 'ADMIN' });
    await expect(
      handler.execute({ actorUserId: 'a', targetUserId: 'b', role: 'RECEPTIONIST' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN promoting RECEPTIONIST to ADMIN', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'a', role: 'ADMIN', isSuperAdmin: true })
      .mockResolvedValueOnce({ id: 'b', role: 'RECEPTIONIST' });
    prisma.user.update.mockResolvedValue({ id: 'b', role: 'ADMIN' });
    const res = await handler.execute({ actorUserId: 'a', targetUserId: 'b', role: 'ADMIN' });
    expect(res.role).toBe('ADMIN');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'ADMIN',
          tokenVersion: { increment: 1 },
        }),
      }),
    );
  });

  it('rejects missing customRole', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'a', role: 'ADMIN', isSuperAdmin: true })
      .mockResolvedValueOnce({ id: 'b', role: 'RECEPTIONIST' });
    prisma.customRole.findUnique.mockResolvedValue(null);
    await expect(
      handler.execute({ actorUserId: 'a', targetUserId: 'b', customRoleId: 'cr-missing' }),
    ).rejects.toThrow(NotFoundException);
  });
});
