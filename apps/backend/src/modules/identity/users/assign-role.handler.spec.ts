import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { AssignRoleHandler } from './assign-role.handler';

describe('AssignRoleHandler', () => {
  let handler: AssignRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignRoleHandler,
        { provide: PrismaService, useValue: {
          customRole: { findFirst: jest.fn() },
          user: { findUnique: jest.fn(), updateMany: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<AssignRoleHandler>(AssignRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);

    (prisma.user.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'actor-1'
            ? { id: 'actor-1', role: 'ADMIN', isSuperAdmin: false }
            : { id: 'u1', role: 'EMPLOYEE' },
        ),
    );
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should assign role', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    await handler.execute({ actorUserId: 'actor-1', userId: 'u1', customRoleId: 'role' });
    expect(prisma.user.updateMany).toHaveBeenCalled();
  });

  it('should throw when role not found', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ actorUserId: 'actor-1', userId: 'u1', customRoleId: 'role' })).rejects.toThrow();
  });

  it('should throw when user not found', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await expect(handler.execute({ actorUserId: 'actor-1', userId: 'u1', customRoleId: 'role' })).rejects.toThrow();
  });

  it('should block assigning a role to your own account (self-escalation)', async () => {
    await expect(
      handler.execute({ actorUserId: 'u1', userId: 'u1', customRoleId: 'role' }),
    ).rejects.toThrow('Cannot change your own role');
    expect(prisma.customRole.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('should block assigning a custom role to a target at the actor rank or above', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    (prisma.user.findUnique as jest.Mock).mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'actor-1'
            ? { id: 'actor-1', role: 'ADMIN', isSuperAdmin: false }
            : { id: 'u1', role: 'ADMIN' },
        ),
    );

    await expect(
      handler.execute({ actorUserId: 'actor-1', userId: 'u1', customRoleId: 'role' }),
    ).rejects.toThrow('Cannot modify a user at or above your rank');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it('rejects an equally privileged superadmin stored with the ADMIN enum', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'ADMIN', isSuperAdmin: true });
    await expect(handler.execute({ actorUserId: 'actor-1', userId: 'u1', customRoleId: 'role' }))
      .rejects.toThrow('Cannot modify a user at or above your rank');
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

});
