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
          user: { updateMany: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<AssignRoleHandler>(AssignRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);
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
});
